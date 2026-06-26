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

    // AI succeeded but dropped sections → deterministic recovery filled them.
    expect(doc.meta.parseQuality.extractionSource).toBe('text+recovery');
    expect(doc.meta.parseQuality.fallbackSections).toEqual(
      expect.arrayContaining(['education', 'certificates', 'projects', 'languages']),
    );
    // incompleteSections must EXCLUDE everything recovery filled.
    const incomplete = doc.meta.parseQuality.incompleteSections ?? [];
    expect(incomplete).not.toEqual(
      expect.arrayContaining(['education', 'certificates', 'projects', 'languages']),
    );

    // The fragile focused AI retry is gone — exactly ONE parse call, recovery is
    // deterministic.
    expect(mockGeminiClient.parseResumeOnly).toHaveBeenCalledTimes(1);
    expect(doc.meta.parseQuality.aiParseFailed).toBeUndefined();
  });

  it('does not spend a second full-resume call on partial experience alone', async () => {
    mockGeminiClient.parseResumeOnly.mockResolvedValue({
      basics: { name: 'Abdullah Bin Ahmed', email: 'abdullah@example.com', phone: '+966 50 123 4567' },
      work: [{ position: 'Lead IT', name: 'Watheq', highlights: [] }],
      education: [{ institution: 'King Fahd University' }],
      certificates: [{ name: 'AWS Certified Solutions Architect' }],
      projects: [{ name: 'Enterprise Resume Optimization Platform' }],
      skills: [{ name: 'Skills', keywords: ['Cloud'] }],
      languages: [{ language: 'Arabic', fluency: 'Native' }],
      meta: { raw_text: RAW_RESUME },
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ kind: 'text', value: RAW_RESUME }),
      headers: { Authorization: 'Bearer test-token' },
    } as Partial<HandlerEvent>;

    const result = (await handler(event as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(200);
    expect(mockGeminiClient.parseResumeOnly).toHaveBeenCalledTimes(1);

    const doc = JSON.parse(result.body).document;
    // work.length >= 1 ⇒ experience is a present (partial) section, NOT "missing".
    expect(doc.meta.parseQuality?.incompleteSections ?? []).not.toContain('experience');
    expect(doc.meta.parseQuality?.retried).toBeUndefined();
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

// A >3000-char fixture whose extracted-text shape mirrors real pdf.js output for
// the attached 2-page resume: a space/chip-separated SKILLS row (NOT comma-
// separated), three "<role> at <company>  <dates>" experience blocks with bullet
// achievements, and page-2 PROJECTS / EDUCATION / CERTIFICATIONS / LANGUAGES.
const PAGE2_SKILLS_LINE =
  'SQL    Power BI    PostgreSQL (Supabase)    React 19    TypeScript    Power Query (M Language)    Technical Support Documentation    Sentry/Telegram Webhooks    CI/CD (Netlify)';

function buildFullResume(): string {
  const filler =
    'Delivered measurable enterprise outcomes across cloud workflows, asset support systems, and cross-functional teams while maintaining strict data quality and reliability standards. Partnered with operations stakeholders to streamline reporting pipelines, reduce manual reconciliation, and accelerate incident response across multiple business-critical applications and integrations.';
  return [
    'ABDULLAH BIN AHMED',
    'abdullah@example.com | +966 50 123 4567 | Dammam, Saudi Arabia',
    'linkedin.com/in/abdullah-ahmed',
    '',
    'SUMMARY',
    `Saudi enterprise IT analyst bridging digital transformation and industrial operations. ${filler} ${filler}`,
    '',
    'EXPERIENCE',
    'Lead Technical Support & Integrations Engineer at CB&I    Mar 2021 - Present',
    filler,
    'Automated recurring asset reports, cutting manual effort by 40%.',
    'IT Operations & Asset Support Analyst at CB&I    Jan 2019 - Feb 2021',
    filler,
    'Maintained asset data pipelines and technical support documentation.',
    'Asset Data Support Specialist at Saudi Aramco    2017 - 2018',
    filler,
    'Supported enterprise reporting and data quality initiatives.',
    '',
    'SKILLS',
    PAGE2_SKILLS_LINE,
    '',
    'PROJECTS',
    'Automated Application Support Bot',
    'Built a Telegram bot that triages incoming support tickets and routes them automatically. ' + filler,
    '',
    'EDUCATION',
    'Saudi Petroleum Services Polytechnic',
    'Diploma in Information Technology    2016',
    '',
    'CERTIFICATIONS',
    'AI Fluency & Prompt Engineering Frameworks (Anthropic/Claude)',
    'AWS Certified Cloud Practitioner',
    '',
    'LANGUAGES',
    'Arabic: Native',
    'English: Professional',
  ].join('\n');
}

const flattenSkillKeywords = (skills: Array<{ keywords?: string[] }>) =>
  (Array.isArray(skills) ? skills : []).flatMap((s) => s.keywords ?? []);

describe('extract-resume-json — full 2-page parse (Test D)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockSupabaseClientModule.getSupabaseClient.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });
  });

  const fullResumeEvent = () =>
    ({
      httpMethod: 'POST',
      body: JSON.stringify({ kind: 'text', value: buildFullResume() }),
      headers: { Authorization: 'Bearer test-token' },
    }) as Partial<HandlerEvent>;

  it('recovers skills the AI dropped while keeping every other section (the logged bug)', async () => {
    // Reproduces the log: Work/Education/Projects/Certs present, but Skills: 0.
    mockGeminiClient.parseResumeOnly.mockResolvedValue({
      basics: { name: 'Abdullah Bin Ahmed', email: 'abdullah@example.com', phone: '+966 50 123 4567' },
      work: [
        { position: 'Lead Technical Support & Integrations Engineer', name: 'CB&I', highlights: ['Automated recurring asset reports, cutting manual effort by 40%.'] },
        { position: 'IT Operations & Asset Support Analyst', name: 'CB&I', highlights: ['Maintained asset data pipelines and technical support documentation.'] },
        { position: 'Asset Data Support Specialist', name: 'Saudi Aramco', highlights: ['Supported enterprise reporting and data quality initiatives.'] },
      ],
      education: [{ institution: 'Saudi Petroleum Services Polytechnic', area: 'Information Technology', studyType: 'Diploma' }],
      projects: [{ name: 'Automated Application Support Bot', description: '', highlights: [] }],
      certificates: [{ name: 'AI Fluency & Prompt Engineering Frameworks', issuer: 'Anthropic/Claude', date: '' }],
      skills: [], // <-- the bug: skills dropped despite a visible SKILLS section
      languages: [{ language: 'Arabic', fluency: 'Native' }, { language: 'English', fluency: 'Professional' }],
      meta: { raw_text: buildFullResume() },
    });

    const result = (await handler(fullResumeEvent() as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(200);
    const doc = JSON.parse(result.body).document;

    expect(doc.plainText.length).toBeGreaterThan(3000);
    expect(doc.work.length).toBeGreaterThanOrEqual(3);
    expect(doc.projects.map((p: { name: string }) => p.name)).toContain('Automated Application Support Bot');
    expect(doc.education.map((e: { institution: string }) => e.institution)).toContain('Saudi Petroleum Services Polytechnic');
    expect(doc.certificates.map((c: { name: string }) => c.name)).toContain('AI Fluency & Prompt Engineering Frameworks');
    expect(doc.languages.map((l: { language: string }) => l.language)).toEqual(expect.arrayContaining(['Arabic', 'English']));

    const skillKeywords = flattenSkillKeywords(doc.skills);
    expect(skillKeywords).toEqual(
      expect.arrayContaining(['SQL', 'Power BI', 'PostgreSQL (Supabase)', 'React 19', 'TypeScript', 'Power Query (M Language)']),
    );
    expect(doc.meta.parseQuality.fallbackSections).toContain('skills');
    expect(doc.meta.parseQuality.extractionSource).toBe('text+recovery');
  });

  it('returns a deterministic 200 (never 500) when the AI parser and fallback both fail', async () => {
    mockGeminiClient.parseResumeOnly.mockRejectedValue(
      Object.assign(new Error('AI request timed out after 25000ms'), { name: 'TimeoutError', status: 504 }),
    );

    const result = (await handler(fullResumeEvent() as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(200);
    const doc = JSON.parse(result.body).document;

    // Deterministic skeleton built from raw text — all sections present.
    expect(doc.plainText.length).toBeGreaterThan(3000);
    expect(doc.work.length).toBeGreaterThanOrEqual(3);
    expect(doc.projects.map((p: { name: string }) => p.name).join(' ')).toContain('Automated Application Support Bot');
    expect(JSON.stringify(doc.education)).toContain('Saudi Petroleum Services Polytechnic');
    expect(flattenSkillKeywords(doc.skills)).toEqual(
      expect.arrayContaining(['SQL', 'Power BI', 'PostgreSQL (Supabase)', 'Power Query (M Language)']),
    );
    expect(doc.languages.map((l: { language: string }) => l.language)).toEqual(expect.arrayContaining(['Arabic', 'English']));

    expect(doc.meta.parseQuality.aiParseFailed).toBe(true);
    expect(doc.meta.parseQuality.confidence).toBe('low');
    expect(doc.meta.parseQuality.extractionSource).toBe('text+deterministic');
    expect(doc.meta.parseQuality.aiFailureCode).toBeTruthy();

    // The deterministic fallback document MUST carry a non-empty basics.name —
    // the frontend BasicsSchema requires it (name: z.string().min(1)), so an
    // unnamed fallback would fail store validation and render an empty header.
    expect(typeof doc.basics.name).toBe('string');
    expect(doc.basics.name.length).toBeGreaterThan(0);
    expect(doc.basics.name).toContain('ABDULLAH');
  });

  it('recovers dropped work entries deterministically and does not mislabel experience as missing', async () => {
    mockGeminiClient.parseResumeOnly.mockResolvedValue({
      basics: { name: 'Abdullah Bin Ahmed', email: 'abdullah@example.com', phone: '+966 50 123 4567' },
      work: [], // AI dropped every work entry despite 3 visible blocks
      education: [{ institution: 'Saudi Petroleum Services Polytechnic' }],
      projects: [{ name: 'Automated Application Support Bot' }],
      certificates: [{ name: 'AI Fluency & Prompt Engineering Frameworks' }],
      skills: [{ name: 'Skills', keywords: ['SQL'] }],
      languages: [{ language: 'Arabic' }, { language: 'English' }],
      meta: { raw_text: buildFullResume() },
    });

    const result = (await handler(fullResumeEvent() as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(200);
    const doc = JSON.parse(result.body).document;

    expect(doc.work.length).toBeGreaterThanOrEqual(3);
    expect(doc.meta.parseQuality.fallbackSections).toContain('experience');
    expect(doc.meta.parseQuality?.incompleteSections ?? []).not.toContain('experience');
  });
});
