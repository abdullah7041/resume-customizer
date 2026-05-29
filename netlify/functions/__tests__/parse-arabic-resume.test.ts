import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';

const mockOpenRouter = {
  callOpenRouter: vi.fn(),
};

const mockRateLimiter = {
  withRateLimit: (_name: string, handler: Function) => handler,
};

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
};

const mockSupabaseClientModule = {
  getSupabaseClient: vi.fn(() => mockSupabaseClient),
};

const mockSentry = {
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }),
};

vi.mock('../../lib/openrouter-client.js', () => mockOpenRouter);
vi.mock('../../lib/rate-limiter.js', () => mockRateLimiter);
vi.mock('../../lib/supabase-client.js', () => mockSupabaseClientModule);
vi.mock('../../lib/sentry.js', () => mockSentry);

const { handler } = await import('../parse-arabic-resume.js');

const mockContext = {} as HandlerContext;

function buildEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    httpMethod: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    queryStringParameters: null,
    body: JSON.stringify({
      resumeText: 'Ahmed Engineer Python APIs cloud delivery leadership measurable outcomes',
      targetLanguage: 'en',
    }),
    ...overrides,
  } as HandlerEvent;
}

describe('parse-arabic-resume function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockSupabaseClientModule.getSupabaseClient.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });
  });

  it('requires authentication before calling OpenRouter', async () => {
    const result = await handler(buildEvent({ headers: {} }), mockContext) as HandlerResponse;

    expect(result.statusCode).toBe(401);
    expect(mockOpenRouter.callOpenRouter).not.toHaveBeenCalled();
  });

  it('rejects oversized resume text before calling OpenRouter', async () => {
    const result = await handler(
      buildEvent({ body: JSON.stringify({ resumeText: 'A'.repeat(50_001) }) }),
      mockContext
    ) as HandlerResponse;

    expect(result.statusCode).toBe(413);
    expect(mockOpenRouter.callOpenRouter).not.toHaveBeenCalled();
  });

  it('parses authenticated requests through OpenRouter', async () => {
    mockOpenRouter.callOpenRouter.mockResolvedValue(JSON.stringify({
      personalInfo: { name: 'Ahmed', email: '', phone: '', location: '', linkedin: '' },
      objective: '',
      experience: [],
      education: [],
      skills: ['Python'],
      certifications: [],
      languages: [],
    }));

    const result = await handler(buildEvent(), mockContext) as HandlerResponse;

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).personalInfo.name).toBe('Ahmed');
    expect(mockOpenRouter.callOpenRouter).toHaveBeenCalledWith(
      'lite',
      expect.any(Array),
      null,
      expect.objectContaining({ featureName: 'parse_arabic_resume' })
    );
  });
});
