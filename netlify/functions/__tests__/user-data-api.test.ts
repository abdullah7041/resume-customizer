import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

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
  };
  return builder;
};

const mockServiceClient = {
  from: vi.fn((table: string) => {
    if (table === 'user_profiles') return createQueryBuilder({ email: 'private@example.com' });
    if (table === 'resumes') return createQueryBuilder([{ email: 'private@example.com' }]);
    if (table === 'job_matches') return createQueryBuilder([{ email: 'private@example.com' }]);
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
}));

const { handler } = await import('../user-data-api.js');

const mockContext = {} as HandlerContext;

describe('user-data-api function', () => {
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
  });
});
