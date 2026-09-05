import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

const mocks = vi.hoisted(() => ({
  sendBatch: vi.fn(),
  listUsers: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../../lib/email-service.js', () => ({
  sendMonthlyUsageSummaryBatch: mocks.sendBatch,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { listUsers: mocks.listUsers } },
    from: mocks.from,
  }),
}));

vi.mock('../../lib/sentry.js', () => ({
  redactForLog: (value: unknown) => String(value),
  summarizeErrorForLog: (error: unknown) => ({ message: String(error) }),
}));

const buildEvent = () =>
  ({ headers: { 'x-netlify-internal-functions': 'true' }, httpMethod: 'POST' }) as unknown as HandlerEvent;

/**
 * The two reads the handler makes before building recipients.
 *
 * `user_credits` is awaited straight off `.select()`; `credit_transactions` adds
 * `.gte()`. Both have to be thenable at the level the handler awaits, or the
 * destructure yields undefined and the run quietly takes the no-credits fallback
 * instead of the path being tested.
 */
const supabaseTable = (table: string) => {
  const rows = { data: [], error: null };
  if (table === 'credit_transactions') {
    return { select: () => ({ gte: () => Promise.resolve(rows) }) };
  }
  return { select: () => Promise.resolve(rows) };
};

describe('cron-monthly-summary reporting', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.sendBatch.mockReset();
    mocks.listUsers.mockReset();
    mocks.from.mockReset();
    mocks.from.mockImplementation(supabaseTable);
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('counts the summaries that were delivered, not the ones it tried to send', async () => {
    // Reporting every recipient as processed regardless of outcome makes a run
    // where the provider rejected two of three look identical to a clean one —
    // and this is a scheduled function nobody watches.
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'u1', email: 'one@example.com', user_metadata: {} },
          { id: 'u2', email: 'two@example.com', user_metadata: {} },
          { id: 'u3', email: 'three@example.com', user_metadata: {} },
        ],
      },
      error: null,
    });
    mocks.sendBatch.mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      errors: [
        { email: 'two@example.com', error: 'invalid recipient' },
        { email: 'three@example.com', error: 'invalid recipient' },
      ],
    });

    const { handler } = await import('../cron-monthly-summary.js');
    const response = await handler(buildEvent(), {} as HandlerContext, () => {});

    // All three are still sent — users with no credits row fall back to empty
    // stats rather than being dropped — so the gap between 3 and 1 is delivery.
    expect(mocks.sendBatch).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ email: 'one@example.com' }),
      expect.objectContaining({ email: 'two@example.com' }),
      expect.objectContaining({ email: 'three@example.com' }),
    ]));

    const body = JSON.parse((response as { body: string }).body);
    expect(body.usersProcessed).toBe(1);
    expect(body.emailFailures).toBe(2);
  });
});
