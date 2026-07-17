import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerResponse } from '@netlify/functions';

const { safeFetchMock, checkFreePreviewMock, getUserMock } = vi.hoisted(() => ({
  safeFetchMock: vi.fn(),
  checkFreePreviewMock: vi.fn(
    async (): Promise<{ allowed: boolean; response?: { statusCode: number; body?: string } }> => ({ allowed: true }),
  ),
  getUserMock: vi.fn(),
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
  checkFreePreviewRateLimit: checkFreePreviewMock,
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

vi.mock('../../lib/safe-fetch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/safe-fetch.js')>();
  return { ...actual, safeFetch: safeFetchMock };
});

const { handler } = await import('../import-job-url.js');
const { SafeFetchError } = await import('../../lib/safe-fetch.js');

const invoke = async (body: unknown, headers: Record<string, string> = {}): Promise<HandlerResponse> => {
  const event = {
    httpMethod: 'POST',
    headers,
    body: JSON.stringify(body),
  } as unknown as HandlerEvent;
  return (await handler(event, {} as never)) as HandlerResponse;
};

const parseBody = (response: HandlerResponse) => JSON.parse(response.body ?? '{}');

const JOB_PAGE_HTML = `
  <html><head><script type="application/ld+json">${JSON.stringify({
    '@type': 'JobPosting',
    title: 'Backend Engineer',
    hiringOrganization: { name: 'Acme' },
    description: '<p>' + 'A detailed responsibility line for the backend engineer role. '.repeat(8) + '</p>',
  })}</script></head><body></body></html>
`;

beforeEach(() => {
  vi.clearAllMocks();
  checkFreePreviewMock.mockResolvedValue({ allowed: true });
});

describe('import-job-url handler', () => {
  it('imports a public job page (guest, rate-limited path)', async () => {
    safeFetchMock.mockResolvedValue({
      status: 200,
      headers: {},
      body: JOB_PAGE_HTML,
      finalUrl: 'https://boards.example.com/acme/jobs/1',
      redirects: [],
    });

    const response = await invoke({ url: 'https://boards.example.com/acme/jobs/1' });
    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.status).toBe('ok');
    expect(body.jobText).toContain('backend engineer role');
    expect(body.jobTitle).toBe('Backend Engineer');
    expect(body.companyName).toBe('Acme');
    expect(body.source).toBe('json-ld');
    expect(checkFreePreviewMock).toHaveBeenCalledWith(expect.anything(), 'import-job-url-guest');
  });

  it('rejects invalid request bodies with 400', async () => {
    const response = await invoke({ url: '' });
    expect(response.statusCode).toBe(400);
  });

  it('returns the guest rate-limit response when exhausted', async () => {
    checkFreePreviewMock.mockResolvedValue({
      allowed: false,
      response: { statusCode: 429, body: JSON.stringify({ error: 'limit' }) },
    });
    const response = await invoke({ url: 'https://example.com/jobs/1' });
    expect(response.statusCode).toBe(429);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it('skips the guest limiter for authenticated users', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    safeFetchMock.mockResolvedValue({
      status: 200, headers: {}, body: JOB_PAGE_HTML, finalUrl: 'https://x.example/1', redirects: [],
    });
    const response = await invoke({ url: 'https://x.example/1' }, { authorization: 'Bearer token' });
    expect(parseBody(response).status).toBe('ok');
    expect(checkFreePreviewMock).not.toHaveBeenCalled();
  });

  it('canonicalizes LinkedIn job links before fetching', async () => {
    safeFetchMock.mockResolvedValue({
      status: 200, headers: {}, body: JOB_PAGE_HTML,
      finalUrl: 'https://www.linkedin.com/jobs/view/123/', redirects: [],
    });
    await invoke({ url: 'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=123' });
    expect(safeFetchMock).toHaveBeenCalledWith('https://www.linkedin.com/jobs/view/123/', expect.anything());
  });

  it('returns unsupported_url for LinkedIn links without a job id', async () => {
    const response = await invoke({ url: 'https://www.linkedin.com/feed/' });
    expect(parseBody(response)).toMatchObject({ status: 'failed', failureReason: 'unsupported_url' });
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it('maps a LinkedIn auth wall to a recoverable login_required state', async () => {
    safeFetchMock.mockResolvedValue({
      status: 200, headers: {}, body: '<html>authwall</html>',
      finalUrl: 'https://www.linkedin.com/authwall?trk=x', redirects: [],
    });
    const response = await invoke({ url: 'https://www.linkedin.com/jobs/view/123/' });
    expect(parseBody(response)).toMatchObject({ status: 'failed', failureReason: 'login_required' });
  });

  it.each([
    ['blocked_private', 'blocked'],
    ['timeout', 'timeout'],
    ['too_large', 'too_large'],
    ['not_html', 'not_html'],
    ['invalid_url', 'invalid_url'],
    ['too_many_redirects', 'unreachable'],
    ['unreachable', 'unreachable'],
  ] as const)('maps SafeFetchError %s to failureReason %s', async (fetchReason, importReason) => {
    safeFetchMock.mockRejectedValue(new SafeFetchError(fetchReason));
    const response = await invoke({ url: 'https://example.com/jobs/1' });
    expect(parseBody(response)).toMatchObject({ status: 'failed', failureReason: importReason });
  });

  it('returns jd_not_found when the page has no reliable description', async () => {
    safeFetchMock.mockResolvedValue({
      status: 200, headers: {}, body: '<html><body><div>app shell only</div></body></html>',
      finalUrl: 'https://example.com/jobs/1', redirects: [],
    });
    const response = await invoke({ url: 'https://example.com/jobs/1' });
    expect(parseBody(response)).toMatchObject({ status: 'failed', failureReason: 'jd_not_found' });
  });

  it('never leaks internal errors to the client', async () => {
    safeFetchMock.mockRejectedValue(new Error('ECONNRESET at 10.4.2.1 internal-gateway'));
    const response = await invoke({ url: 'https://example.com/jobs/1' });
    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body).toMatchObject({ status: 'failed', failureReason: 'unreachable' });
    expect(response.body).not.toContain('internal-gateway');
  });
});
