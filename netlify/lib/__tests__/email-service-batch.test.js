import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    mocks.batchSend.mockReset();
    mocks.emailSend.mockReset();
    mocks.batchSend.mockImplementation(async (payload) => successfulBatchResponse(payload));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
