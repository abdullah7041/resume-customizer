import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  batchSend: vi.fn(),
  emailSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    batch = { send: mocks.batchSend };
    emails = { send: mocks.emailSend };
  },
}));

vi.mock('../sentry.js', () => ({
  redactForLog: vi.fn((value) => String(value)),
}));

const successfulBatchResponse = (payload) => ({
  data: {
    data: payload.map((_, index) => ({ id: `email-${index}` })),
    errors: [],
  },
  error: null,
  headers: {},
});

describe('email-service batch delivery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // A missing key is now a refusal rather than a silent send, so delivery tests
    // have to say they are configured. See "reports a missing API key" below.
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    mocks.batchSend.mockReset();
    mocks.emailSend.mockReset();
    mocks.batchSend.mockImplementation(async (payload) => successfulBatchResponse(payload));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('chunks credit reset notifications into provider batches of at most 100', async () => {
    const emailService = await import('../email-service.js');
    const sendBatch = emailService.sendCreditsRefreshedEmailBatch;

    expect(sendBatch).toBeTypeOf('function');
    if (typeof sendBatch !== 'function') return;

    const recipients = Array.from({ length: 205 }, (_, index) => ({
      email: `user-${index}@example.com`,
      userName: `User ${index}`,
      credits: 20,
      language: 'en',
    }));

    const result = await sendBatch(recipients);

    expect(mocks.batchSend).toHaveBeenCalledTimes(3);
    expect(mocks.batchSend.mock.calls.map(([payload]) => payload.length)).toEqual([100, 100, 5]);
    expect(mocks.emailSend).not.toHaveBeenCalled();
    expect(result).toMatchObject({ successCount: 205, failureCount: 0 });
  });

  it('sends monthly summaries through the batch endpoint', async () => {
    const emailService = await import('../email-service.js');
    const sendBatch = emailService.sendMonthlyUsageSummaryBatch;

    expect(sendBatch).toBeTypeOf('function');
    if (typeof sendBatch !== 'function') return;

    const result = await sendBatch([
      {
        email: 'monthly@example.com',
        userName: 'Monthly User',
        language: 'en',
        stats: {
          totalUsed: 5,
          remaining: 15,
          totalActions: 2,
          usagePercentage: 25,
          nextResetDate: 'August 14, 2026',
          breakdown: {},
        },
      },
    ]);

    expect(mocks.batchSend).toHaveBeenCalledOnce();
    expect(mocks.batchSend.mock.calls[0][0][0]).toMatchObject({
      to: 'monthly@example.com',
      subject: expect.any(String),
      html: expect.stringContaining('Monthly User'),
    });
    expect(result).toMatchObject({ successCount: 1, failureCount: 0 });
  });
});


const monthlyRecipient = (email) => ({
  email,
  userName: 'Monthly User',
  language: 'en',
  stats: {
    totalUsed: 5,
    remaining: 15,
    totalActions: 2,
    usagePercentage: 25,
    nextResetDate: 'August 14, 2026',
    breakdown: {},
  },
});

describe('email-service failure paths', () => {
  beforeEach(() => {
    mocks.batchSend.mockReset();
    mocks.emailSend.mockReset();
    mocks.batchSend.mockImplementation(async (payload) => successfulBatchResponse(payload));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('reports a missing API key instead of crashing on import', async () => {
    // `new Resend(undefined)` throws, and it used to run at module scope — so an
    // unset key took down cron-monthly-summary, cron-reset-credits,
    // notify-waitlist and waitlist-confirm at import time, before a line of
    // handler code ran. That import-time throw cannot be reproduced here, since
    // the `resend` mock above replaces the constructor; what this pins is the
    // behaviour that replaced it — a missing key is a reported failure and no
    // send is attempted.
    vi.stubEnv('RESEND_API_KEY', '');
    vi.resetModules();

    const emailService = await import('../email-service.js');
    const result = await emailService.sendMonthlyUsageSummaryBatch([monthlyRecipient('nokey@example.com')]);

    expect(result).toMatchObject({ successCount: 0, failureCount: 1 });
    expect(result.errors[0].error).toMatch(/RESEND_API_KEY/);
    expect(mocks.batchSend).not.toHaveBeenCalled();
  });

  it('gives up on a provider that never answers', async () => {
    // The SDK exposes no AbortSignal and its transport is a bare fetch, so an
    // unanswered request used to hang the whole function until Netlify killed it.
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.resetModules();
    vi.useFakeTimers();
    mocks.batchSend.mockImplementation(() => new Promise(() => {}));

    const emailService = await import('../email-service.js');
    const pending = emailService.sendCreditsRefreshedEmailBatch([
      { email: 'hung@example.com', userName: 'Hung', credits: 20, language: 'en' },
    ]);

    await vi.advanceTimersByTimeAsync(30_000);
    const result = await pending;

    expect(result).toMatchObject({ successCount: 0, failureCount: 1 });
    expect(result.errors[0].error).toMatch(/timed out/i);
  });

  it('blames the recipient the provider actually rejected', async () => {
    // `errors[].index` is batch-relative. Mapping it to the wrong recipient would
    // tell one user their summary failed while another silently never arrived.
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.resetModules();
    mocks.batchSend.mockImplementation(async (payload) => ({
      data: {
        data: payload.map((_, index) => ({ id: `email-${index}` })),
        errors: [{ index: 1, message: 'invalid recipient' }],
      },
      error: null,
      headers: {},
    }));

    const emailService = await import('../email-service.js');
    const result = await emailService.sendMonthlyUsageSummaryBatch([
      monthlyRecipient('first@example.com'),
      monthlyRecipient('second@example.com'),
      monthlyRecipient('third@example.com'),
    ]);

    expect(result).toMatchObject({ successCount: 2, failureCount: 1 });
    expect(result.errors).toEqual([{ email: 'second@example.com', error: 'invalid recipient' }]);
  });
});
