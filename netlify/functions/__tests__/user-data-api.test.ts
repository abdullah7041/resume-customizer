import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Force the rate limiter's fail-open "not configured" path instead of real
// network calls to the fake test.upstash.io host used elsewhere in the suite.
const originalEnv = { ...process.env };
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const mockSupabaseAnon = {
  auth: {
    getUser: vi.fn(),
  },
};

const createQueryBuilder = (data: unknown) => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data, error: null })),
    delete: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn((resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve)
    ),
  };
  return builder;
};

const mockServiceClient = {
  from: vi.fn((table: string) => {
    if (table === 'user_profiles') return createQueryBuilder({ email: 'private@example.com' });
    if (table === 'user_credits') return createQueryBuilder({ email: 'private@example.com', credits_remaining: 10 });
    if (table === 'credit_transactions') return createQueryBuilder([{ email: 'private@example.com', feature: 'ai_match' }]);
    if (table === 'job_applications') return createQueryBuilder([{ user_id: 'user-123', status: 'applied' }]);
    if (table === 'feedback_reports') return createQueryBuilder([{ user_id: 'user-123', type: 'resume_quality' }]);
    if (table === 'strategic_reality_checks') return createQueryBuilder([{ user_id: 'user-123', risk_tier: 'critical' }]);
    if (table === 'resumes') return createQueryBuilder([{ email: 'private@example.com', legacy: true }]);
    if (table === 'job_matches') return createQueryBuilder([{ email: 'private@example.com', legacy: true }]);
    if (table === 'feedback') return createQueryBuilder([{ email: 'private@example.com', legacy: true }]);
    return createQueryBuilder(null);
  }),
  auth: {
    admin: {
      deleteUser: vi.fn(),
    },
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseAnon),
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => mockServiceClient),
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  redactForLog: vi.fn((value: string) => value.replace(/^[^@]+/, '***')),
  summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }),
}));

const { handler } = await import('../user-data-api.js');

const mockContext = {} as HandlerContext;

describe('user-data-api function', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    mockSupabaseAnon.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'private@example.com',
        },
      },
      error: null,
    });
  });

  it('routes requests through the rate limiter', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const event = {
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ action: 'export' }),
    } as Partial<HandlerEvent>;

    const result = await handler(event as HandlerEvent, mockContext) as HandlerResponse;

    expect(result.statusCode).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Upstash not configured — allowing request to user-data-api')
    );
  });

  it('exports user data without placing raw email in download headers', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ action: 'export' }),
    } as Partial<HandlerEvent>;

    const result = await handler(event as HandlerEvent, mockContext) as HandlerResponse;

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Content-Disposition']).toBe(
      'attachment; filename="watheq-user-data-export.json"'
    );
    expect(result.headers?.['Content-Disposition']).not.toContain('private@example.com');
    const userData = JSON.parse(result.body).userData;
    expect(userData.jobApplications).toEqual([{ user_id: 'user-123', status: 'applied' }]);
    expect(userData.feedbackReports).toEqual([{ user_id: 'user-123', type: 'resume_quality' }]);
    expect(userData.creditTransactions).toEqual([{ email: 'private@example.com', feature: 'ai_match' }]);
    expect(userData.userCredits).toEqual({ email: 'private@example.com', credits_remaining: 10 });
    expect(userData.strategicRealityChecks).toEqual([
      { user_id: 'user-123', risk_tier: 'critical' },
    ]);
    expect(userData.legacyDeprecated).toEqual({
      resumes: [{ email: 'private@example.com', legacy: true }],
      jobMatches: [{ email: 'private@example.com', legacy: true }],
      feedback: [{ email: 'private@example.com', legacy: true }],
    });
    expect(mockServiceClient.from).toHaveBeenCalledWith('job_applications');
    expect(mockServiceClient.from).toHaveBeenCalledWith('feedback_reports');
    expect(mockServiceClient.from).toHaveBeenCalledWith('credit_transactions');
    expect(mockServiceClient.from).toHaveBeenCalledWith('strategic_reality_checks');
  });

  it('deletes active and deprecated user data during account deletion', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ action: 'delete', confirmDelete: true }),
    } as Partial<HandlerEvent>;

    const result = await handler(event as HandlerEvent, mockContext) as HandlerResponse;

    expect(result.statusCode).toBe(200);
    expect(mockServiceClient.from).toHaveBeenCalledWith('job_applications');
    expect(mockServiceClient.from).toHaveBeenCalledWith('feedback_reports');
    expect(mockServiceClient.from).toHaveBeenCalledWith('credit_transactions');
    expect(mockServiceClient.from).toHaveBeenCalledWith('strategic_reality_checks');
    expect(mockServiceClient.from).toHaveBeenCalledWith('resumes');
    expect(mockServiceClient.from).toHaveBeenCalledWith('job_matches');
    expect(mockServiceClient.from).toHaveBeenCalledWith('feedback');
    expect(mockServiceClient.from).toHaveBeenCalledWith('user_credits');
    expect(mockServiceClient.auth.admin.deleteUser).toHaveBeenCalledWith('user-123');
  });
});
