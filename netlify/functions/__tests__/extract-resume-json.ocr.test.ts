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
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Page-delimited OCR transcription the (mocked) vision provider returns for the
// 2-page scanned resume. Page-2-only sentinels live exclusively in page 2 so the
// test can prove page 2 is stitched in — not just page 1.
const OCR_PAGE_1 = [
  'ABDULLAH BIN AHMED',
  'Senior Specialist — Asset Application Support',
  'Lead Technical Support & Integrations Engineer',
  'IT Operations & Asset Support Analyst',
  'Asset Data Support Specialist at CB&I',
  'Skills: SQL, Power BI, PostgreSQL (Supabase), React 19, TypeScript',
].join('\n');

const OCR_PAGE_2 = [
  'PROJECTS',
  'Automated Application Support Bot',
  'EDUCATION',
  'Saudi Petroleum Services Polytechnic',
  'Power Query (M Language)',
  'Technical Support Documentation',
  'CERTIFICATIONS',
  'AI Fluency & Prompt Engineering Frameworks (Anthropic/Claude)',
  'LANGUAGES',
  'Arabic: Native',
  'English: Professional',
].join('\n');

// ----- Mock the OCR provider boundary only (openrouter-client.callOpenRouter) ----
// The REAL ocr-extract helper runs and must stitch the per-page transcription.
const mockCallOpenRouter = vi.fn();
vi.mock('../../lib/openrouter-client.js', () => ({
  callOpenRouter: (...args: unknown[]) => mockCallOpenRouter(...args),
}));

// ----- Deterministic fake parser: output derives ONLY from the text it receives.
// If page-2 text never reached the parser, these arrays would lack page-2 entries.
const KNOWN_POSITIONS = [
  'Lead Technical Support & Integrations Engineer',
  'IT Operations & Asset Support Analyst',
  'Asset Data Support Specialist',
];
const KNOWN_SKILLS = ['SQL', 'Power BI', 'PostgreSQL (Supabase)', 'React 19', 'TypeScript', 'Power Query (M Language)'];

const fakeParse = vi.fn(async (text: string, _isPdf?: boolean, _options?: { timeoutMs?: number }) => {
  const has = (s: string) => text.includes(s);
  const work = KNOWN_POSITIONS.filter(has).map((position) => ({
    position,
    name: has('CB&I') ? 'CB&I' : 'Employer',
    highlights: ['Delivered measurable support outcomes across enterprise asset systems.'],
  }));
  const skills = KNOWN_SKILLS.filter(has);
  return {
    basics: { name: has('ABDULLAH BIN AHMED') ? 'ABDULLAH BIN AHMED' : '' },
    work,
    education: has('Saudi Petroleum Services Polytechnic')
      ? [{ institution: 'Saudi Petroleum Services Polytechnic', area: '', studyType: '' }]
      : [],
    projects: has('Automated Application Support Bot')
      ? [{ name: 'Automated Application Support Bot', description: '', highlights: [] }]
      : [],
    certificates: has('AI Fluency & Prompt Engineering Frameworks')
      ? [{ name: 'AI Fluency & Prompt Engineering Frameworks', issuer: 'Anthropic/Claude', date: '' }]
      : [],
    skills: skills.length ? [{ name: 'Skills', keywords: skills }] : [],
    languages: [
      ...(has('Arabic') ? [{ language: 'Arabic' }] : []),
      ...(has('English') ? [{ language: 'English' }] : []),
    ],
    meta: { raw_text: text },
  };
});

vi.mock('../../lib/gemini-client', () => ({ parseResumeOnly: (...a: [string, boolean?, { timeoutMs?: number }?]) => fakeParse(...a) }));

const mockResumeText = {
  // Image-only PDF ⇒ deterministic extraction returns nothing.
  extractPlainTextFromArrayBuffer: vi.fn(async () => ''),
  inferMimeType: vi.fn(() => 'application/pdf'),
  normalizeResumeText: vi.fn((t: string) => (typeof t === 'string' ? t : '')),
  classifyExtraction: vi.fn(() => 'empty'),
};
vi.mock('../../lib/resumeText.js', () => mockResumeText);

const mockRateLimiter = {
  withRateLimit: (_n: string, h: Function) => h,
  checkGuestPreviewRateLimit: vi.fn(() => Promise.resolve({ allowed: true })),
};
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);

const mockSupabaseClient = { auth: { getUser: vi.fn() } };
vi.mock('../../lib/supabase-client.js', () => ({ getSupabaseClient: vi.fn(() => mockSupabaseClient) }));

vi.mock('../../lib/sentry', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((e: unknown) => (e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) })),
}));

const { handler } = await import('../extract-resume-json.js');

const fileEvent = (extra: Record<string, unknown> = {}, headers: Record<string, string> = { Authorization: 'Bearer test-token' }) =>
  ({
    httpMethod: 'POST',
    body: JSON.stringify({
      kind: 'file',
      name: 'ABDULLAH_BIN_AHMED.pdf',
      mime: 'application/pdf',
      data: Buffer.from('image-only-pdf-bytes').toString('base64'),
      ...extra,
    }),
    headers,
  }) as Partial<HandlerEvent>;

describe('extract-resume-json — scanned/image-only PDF OCR fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue('');
    mockResumeText.inferMimeType.mockReturnValue('application/pdf');
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u@e.com' } }, error: null });
    mockCallOpenRouter.mockResolvedValue(
      JSON.stringify({ pages: [{ pageNumber: 1, text: OCR_PAGE_1 }, { pageNumber: 2, text: OCR_PAGE_2 }] }),
    );
  });

  it('OCRs every page of a signed-in scanned PDF and parses the full resume', async () => {
    const result = (await handler(fileEvent() as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(200);
    const doc = JSON.parse(result.body).document;

    // The parser received the STITCHED text from BOTH pages.
    const parsedText = fakeParse.mock.calls[0][0] as string;
    expect(parsedText).toContain('Lead Technical Support & Integrations Engineer'); // page 1
    expect(parsedText).toContain('Automated Application Support Bot'); // page 2 only

    // plainText carries page-2 content.
    expect(doc.plainText).toContain('Saudi Petroleum Services Polytechnic');

    // Structured output reflects all pages.
    expect(doc.work.length).toBeGreaterThanOrEqual(3);
    expect(doc.projects.map((p: { name: string }) => p.name)).toContain('Automated Application Support Bot');
    expect(doc.education.map((e: { institution: string }) => e.institution)).toContain('Saudi Petroleum Services Polytechnic');
    const skillKeywords = doc.skills.flatMap((s: { keywords?: string[] }) => s.keywords ?? []);
    expect(skillKeywords).toEqual(
      expect.arrayContaining(['SQL', 'Power BI', 'PostgreSQL (Supabase)', 'React 19', 'TypeScript', 'Power Query (M Language)']),
    );
    expect(doc.certificates.map((c: { name: string }) => c.name)).toContain('AI Fluency & Prompt Engineering Frameworks');
    expect(doc.languages.map((l: { language: string }) => l.language)).toEqual(expect.arrayContaining(['Arabic', 'English']));

    // OCR metadata is recorded.
    expect(doc.meta.parseQuality.ocrFallback).toBe(true);
    expect(doc.meta.parseQuality.pagesProcessed).toBe(2);
    expect(doc.meta.parseQuality.extractionSource).toMatch(/^ocr/);

    // OCR and structured parsing share the 30s function budget. Neither provider
    // call may reserve its old standalone timeout (25s OCR + 20s parse = 45s).
    expect(mockCallOpenRouter.mock.calls[0][3].timeoutMs).toBeLessThanOrEqual(12_000);
    expect(fakeParse.mock.calls[0][2]?.timeoutMs).toBeLessThanOrEqual(12_000);
  });

  it('does NOT run OCR for guest previews — returns the unreadable-file rejection', async () => {
    const result = (await handler(fileEvent({ guestPreview: true }, {}) as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(422);
    expect(JSON.parse(result.body).code).toBe('resume/unreadable-file');
    expect(mockCallOpenRouter).not.toHaveBeenCalled();
    expect(fakeParse).not.toHaveBeenCalled();
  });
});
