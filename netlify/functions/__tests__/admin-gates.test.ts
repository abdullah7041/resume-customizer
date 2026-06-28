import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';

const { createClientMock, getSupabaseClientMock, sendWaitlistNotificationMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getSupabaseClientMock: vi.fn(),
  sendWaitlistNotificationMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

vi.mock('../../lib/email-service.js', () => ({
  sendWaitlistNotification: sendWaitlistNotificationMock,
  sendCreditsRefreshedEmail: vi.fn(),
  sendMonthlyUsageSummary: vi.fn(),
}));

vi.mock('../../lib/sentry.js', () => ({
  redactForLog: vi.fn((value: string) => `redacted:${value.length}`),
  summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }),
}));

const { handler: resetCreditsHandler } = await import('../dev-reset-credits.js');
const { handler: celebrationBonusHandler } = await import('../dev-celebration-bonus.js');
const { handler: notifyWaitlistHandler } = await import('../notify-waitlist.js');
const { handler: cronResetCreditsHandler } = await import('../cron-reset-credits.js');

const originalEnv = { ...process.env };
const mockContext = {} as HandlerContext;

function buildEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    httpMethod: 'GET',
    headers: {},
    queryStringParameters: null,
    body: null,
    ...overrides,
  } as HandlerEvent;
}

async function runHandler(
  handler: typeof resetCreditsHandler,
  event: HandlerEvent
): Promise<HandlerResponse> {
  return (await handler(event, mockContext, () => undefined)) as HandlerResponse;
}

describe('protected Netlify function gates', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('blocks dev credit reset before opening the service-role client', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEV_RESET;

    const response = await runHandler(
      resetCreditsHandler,
      buildEvent({ queryStringParameters: { email: 'private@example.com' } })
    );

    expect(response.statusCode).toBe(403);
    expect(getSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('requires an admin secret for dev credit reset when the allow flag is enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_RESET = 'true';
    process.env.ADMIN_SECRET = 'strong-secret';

    const response = await runHandler(
      resetCreditsHandler,
      buildEvent({ queryStringParameters: { email: 'private@example.com' } })
    );

    expect(response.statusCode).toBe(401);
    expect(getSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('requires both the allow flag and admin secret before celebration credit mutation', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_CELEBRATION_BONUS = 'true';
    process.env.ADMIN_SECRET = 'strong-secret';

    const response = await runHandler(
      celebrationBonusHandler,
      buildEvent({
        httpMethod: 'POST',
        headers: { 'x-admin-secret': 'wrong-secret' },
        body: JSON.stringify({ amount: 10, reason: 'Launch promo' }),
      })
    );

    expect(response.statusCode).toBe(401);
    expect(getSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('fails closed for waitlist notifications when ADMIN_SECRET is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_SECRET;

    const response = await runHandler(
      notifyWaitlistHandler,
      buildEvent({ queryStringParameters: { secret: 'change-me-in-production' } })
    );

    expect(response.statusCode).toBe(500);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(sendWaitlistNotificationMock).not.toHaveBeenCalled();
  });

  it('does not accept admin secrets from query strings', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_SECRET = 'strong-secret';

    const response = await runHandler(
      notifyWaitlistHandler,
      buildEvent({ queryStringParameters: { secret: 'strong-secret' } })
    );

    expect(response.statusCode).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(sendWaitlistNotificationMock).not.toHaveBeenCalled();
  });

  it('blocks direct scheduled credit reset calls before service-role work', async () => {
    process.env.NODE_ENV = 'production';

    const response = await runHandler(cronResetCreditsHandler, buildEvent());

    expect(response.statusCode).toBe(403);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
