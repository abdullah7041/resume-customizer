import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

const { buildFeedbackContext, submitFeedbackReport } = await import('./feedback');

describe('feedback service privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          id: 'feedback-1',
          rewardStatus: 'awarded',
          creditsAwarded: 5,
          creditsRemaining: 25,
        }),
      })
    );
    window.history.pushState({}, '', '/templates');
    window.localStorage.setItem('watheq:resumeData', 'Sensitive parsed resume state');
    window.localStorage.setItem('watheq:lastJobDescription', 'Sensitive job text');
    window.localStorage.setItem('resume-storage', 'Sensitive optimization output');
  });

  it('builds only route, browser, and viewport context', () => {
    const context = buildFeedbackContext();

    expect(context.pagePath).toBe('/templates');
    expect(context.userAgent).toBe(window.navigator.userAgent);
    expect(context.viewport).toMatch(/desktop|tablet|mobile/);
    expect(context.contextFeature).toBe('templates');
    expect(JSON.stringify(context)).not.toContain('Sensitive parsed resume state');
    expect(JSON.stringify(context)).not.toContain('Sensitive job text');
    expect(JSON.stringify(context)).not.toContain('Sensitive optimization output');
  });

  it('does not include resume, job, parsed resume, or optimization content in the submission payload', async () => {
    await submitFeedbackReport({
      type: 'resume_quality',
      message: 'The improved summary became too generic for my original resume context.',
      rating: 3,
      validation: {
        trustToApply: 'somewhat',
        willingnessToPay: 'maybe',
      },
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(fetchCall[1]?.body)) as Record<string, unknown>;
    const serializedBody = JSON.stringify(body);

    expect(fetchCall[0]).toBe('/.netlify/functions/feedback-api');
    expect(fetchCall[1]?.method).toBe('POST');
    expect(body).toMatchObject({
      type: 'resume_quality',
      message: 'The improved summary became too generic for my original resume context.',
      rating: 3,
      validation: {
        trustToApply: 'somewhat',
        willingnessToPay: 'maybe',
      },
      context: expect.objectContaining({
        pagePath: '/templates',
        contextFeature: 'templates',
      }),
    });
    expect(serializedBody).not.toContain('Sensitive parsed resume state');
    expect(serializedBody).not.toContain('Sensitive job text');
    expect(serializedBody).not.toContain('Sensitive optimization output');
    expect(serializedBody).not.toContain('resumeText');
    expect(serializedBody).not.toContain('jobText');
    expect(serializedBody).not.toContain('optimization');
    expect(serializedBody).not.toContain('creditsAwarded');
    expect(serializedBody).not.toContain('rewardStatus');
  });
});
