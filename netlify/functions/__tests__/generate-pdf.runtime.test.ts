import type { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { launch, executablePath } = vi.hoisted(() => ({
  launch: vi.fn(),
  executablePath: vi.fn().mockResolvedValue('/tmp/chromium'),
}));

vi.mock('puppeteer-core', () => ({ default: { launch } }));
vi.mock('@sparticuz/chromium', () => ({
  default: { executablePath, args: ['--lambda-chromium-arg'] },
}));
vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: Handler) => handler,
}));
vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  for (const key of ['NETLIFY', 'NETLIFY_DEV', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_EXECUTION_ENV', 'AWS_LAMBDA_JS_RUNTIME']) {
    vi.stubEnv(key, undefined);
  }
  const page = {
    setViewport: vi.fn(), setRequestInterception: vi.fn(), on: vi.fn(),
    setJavaScriptEnabled: vi.fn(), setContent: vi.fn(), waitForNetworkIdle: vi.fn(),
    emulateMediaType: vi.fn(), evaluateHandle: vi.fn(), evaluate: vi.fn(),
    pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')), close: vi.fn(),
  };
  launch.mockResolvedValue({ newPage: async () => page, isConnected: () => true });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('PDF browser runtime selection', () => {
  it.each([
    ['AWS_LAMBDA_FUNCTION_NAME', 'generate-pdf', '/tmp/chromium', ['--lambda-chromium-arg']],
    ['AWS_EXECUTION_ENV', 'AWS_Lambda_nodejs22.x', '/tmp/chromium', ['--lambda-chromium-arg']],
    ['AWS_LAMBDA_JS_RUNTIME', 'nodejs22.x', '/tmp/chromium', ['--lambda-chromium-arg']],
    ['NETLIFY', 'true', '/tmp/chromium', ['--lambda-chromium-arg']],
    ['NETLIFY', undefined, '/usr/bin/google-chrome', ['--no-sandbox', '--disable-setuid-sandbox']],
    ['NETLIFY_DEV', 'true', '/usr/bin/google-chrome', ['--no-sandbox', '--disable-setuid-sandbox']],
  ] as const)('launches the correct browser with %s alone', async (marker, value, path, args) => {
    vi.stubEnv(marker, value);
    const { handler } = await import('../generate-pdf.js');

    const response = await handler({
      httpMethod: 'POST', headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ html: '<p>Resume</p>' }),
    } as unknown as HandlerEvent, {} as HandlerContext, () => {});

    expect(response).toMatchObject({ statusCode: 200 });
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ executablePath: path, args }));
    expect(executablePath).toHaveBeenCalledTimes(path === '/tmp/chromium' ? 1 : 0);
  });

  it('keeps the local browser in Netlify Dev when the hosted JS runtime setting is loaded', async () => {
    vi.stubEnv('NETLIFY_DEV', 'true');
    vi.stubEnv('AWS_LAMBDA_JS_RUNTIME', 'nodejs22.x');
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    const { handler } = await import('../generate-pdf.js');

    const response = await handler({
      httpMethod: 'POST', headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ html: '<p>Resume</p>' }),
    } as unknown as HandlerEvent, {} as HandlerContext, () => {});

    expect(response).toMatchObject({ statusCode: 200 });
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }));
    expect(executablePath).not.toHaveBeenCalled();
  });
});
