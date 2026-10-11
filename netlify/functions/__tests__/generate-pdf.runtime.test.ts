import type { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const hostPlatform = process.platform;

const { launch, executablePath, getUser, rateLimit, readFont, mkdir, writeFont } = vi.hoisted(() => ({
  launch: vi.fn(),
  executablePath: vi.fn().mockResolvedValue('/tmp/chromium'),
  getUser: vi.fn(),
  rateLimit: vi.fn((_name: string, handler: Handler) => handler),
  readFont: vi.fn(),
  mkdir: vi.fn(),
  writeFont: vi.fn(),
}));

vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, readFileSync: readFont, mkdirSync: mkdir, writeFileSync: writeFont };
});

vi.mock('puppeteer-core', () => ({ default: { launch } }));
vi.mock('@sparticuz/chromium', () => ({
  default: { executablePath, args: ['--lambda-chromium-arg'] },
}));
vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: rateLimit,
}));
vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: () => ({
    auth: { getUser },
  }),
}));

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  readFont.mockReset();
  mkdir.mockReset();
  writeFont.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
  const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
  readFont.mockImplementation((path: string) => fs.readFileSync(path));
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
    expect(readFont).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFont).not.toHaveBeenCalled();
  });
});

describe('serverless styled font provisioning', () => {
  const call = async () => {
    const { handler } = await import('../generate-pdf.js');
    return handler({ httpMethod: 'POST', headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ html: '<p>English مرحبا</p>' }) } as unknown as HandlerEvent, {} as HandlerContext, () => {});
  };
  beforeEach(() => { vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'generate-pdf'); });
  it('makes the approved font available before launch and retains it across pooled exports', async () => {
    const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const approvedFont = fs.readFileSync(resolve(process.cwd(), 'netlify/assets/fonts/DejaVuSans.ttf'));
    const files = new Map<string, Buffer>();
    writeFont.mockImplementation((path: string, bytes: Buffer) => { files.set(path, bytes); });
    const browser = await launch.getMockImplementation()?.();
    launch.mockImplementation(async () => {
      expect(files.get('/tmp/fonts/DejaVuSans.ttf')?.equals(approvedFont)).toBe(true);
      return browser;
    });
    expect(await call()).toMatchObject({ statusCode: 200 });
    expect(await call()).toMatchObject({ statusCode: 200 });
    expect(files.get('/tmp/fonts/DejaVuSans.ttf')?.equals(approvedFont)).toBe(true);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(mkdir).toHaveBeenCalledWith('/tmp/fonts', { recursive: true });
    expect(executablePath.mock.invocationCallOrder[0]).toBeLessThan(writeFont.mock.invocationCallOrder[0]);
  });
  it.each(['read', 'integrity', 'directory', 'write'])('fails without PDF success when font %s fails', async failure => {
    if (failure === 'read') readFont.mockImplementationOnce(() => { throw new Error('font unavailable'); });
    if (failure === 'integrity') readFont.mockReturnValueOnce(Buffer.from('corrupted font'));
    if (failure === 'directory') mkdir.mockImplementationOnce(() => { throw new Error('directory unavailable'); });
    if (failure === 'write') writeFont.mockImplementationOnce(() => { throw new Error('write unavailable'); });
    expect(await call()).toMatchObject({ statusCode: 500 });
    expect(launch).not.toHaveBeenCalled();
  });
});

describe('authenticated text layout', () => {
  const request = { format: 'text', blocks: [{ kind: 'title', runs: [{ text: 'Noura Example' }] }], templateId: 'modern-professional', filename: 'Noura-text' };
  const call = async (body: unknown, authenticated = true) => {
    const { handler } = await import('../generate-pdf.js');
    const response = await handler({ httpMethod: 'POST', headers: authenticated ? { authorization: 'Bearer test-token' } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) } as HandlerEvent, {} as HandlerContext, () => {});
    if (!response) throw new Error('Expected a handler response');
    return response;
  };
  it('authenticates before parsing or loading the font', async () => {
    expect(await call('malformed', false)).toMatchObject({ statusCode: 401 });
    getUser.mockResolvedValueOnce({ data: { user: null }, error: {} });
    expect(await call(request)).toMatchObject({ statusCode: 401 });
    expect(readFont).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });
  it.each(['{', { ...request, blocks: [] }, { ...request, blocks: [{ kind: 'body', runs: [{ text: 'secret', href: 'file:///private' }] }] }, { ...request, blocks: [{ kind: 'body', runs: [{ text: 'x'.repeat(10001) }] }] }, { ...request, width: 20 }, { ...request, templateId: 'bad' }, { ...request, format: 'unknown' }])('rejects malformed text contracts with bounded 400', async body => {
    const response = await call(body);
    expect(response).toMatchObject({ statusCode: 400 });
    expect(response?.body).not.toContain('secret');
    expect(launch).not.toHaveBeenCalled();
  });
  it.each(['漢字', 'سَّ', '\ufb01'])('returns bounded unsupported rendering 422 without sensitive logging', async text => {
    const log = vi.spyOn(console, 'error');
    const response = await call({ ...request, blocks: [{ kind: 'body', runs: [{ text }] }] });
    expect(response).toMatchObject({ statusCode: 422 });
    expect(JSON.parse(response!.body)).toMatchObject({ status: 422, code: 'pdf/text-unsupported' });
    expect(response!.body).not.toContain(text);
    expect(log).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });
  it('fails closed at the 20-page server layout limit', async () => {
    const response = await call({ ...request, blocks: Array.from({ length: 1000 }, () => ({ kind: 'body', runs: [{ text: 'Example row' }] })) });
    expect(response).toMatchObject({ statusCode: 422 });
    expect(JSON.parse(response!.body).code).toBe('pdf/text-unsupported');
  });
  it('uses the existing wrapper and returns a native PDF contract without Chromium/network', async () => {
    const network = vi.spyOn(globalThis, 'fetch');
    const response = await call(request);
    expect(response).toMatchObject({ statusCode: 200, isBase64Encoded: true, headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="Noura-text.pdf"' } });
    expect(Buffer.from(response!.body, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(rateLimit).toHaveBeenCalledWith('generate-pdf', expect.any(Function));
    expect(readFont).toHaveBeenCalledWith(expect.stringMatching(/netlify[/\\]assets[/\\]fonts[/\\]DejaVuSans.ttf$/));
    expect(launch).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it('returns bounded font-load recovery without logging source or filesystem details', async () => {
    readFont.mockImplementationOnce(() => { throw new Error('missing /private/font'); });
    const log = vi.spyOn(console, 'error');
    const response = await call(request);
    expect(response).toMatchObject({ statusCode: 503 });
    expect(JSON.parse(response!.body)).toMatchObject({ status: 503, code: 'pdf/text-font-unavailable' });
    expect(response!.body).not.toContain('/private');
    expect(log).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });
  it('loads the included font from a built function root after esbuild relocation', async () => {
    const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const workspace = fileURLToPath(new URL('../../../', import.meta.url));
    // Keep external package resolution under the project without an ignored scratch parent.
    const scratchParent = resolve(workspace);
    const root = fs.mkdtempSync(resolve(scratchParent, 'watheq-text-pdf-bundle-'));
    if (!resolve(root).startsWith(scratchParent + sep)) throw new Error('Unexpected fixture path');
    try {
      const font = resolve(root, 'netlify/assets/fonts/DejaVuSans.ttf');
      fs.mkdirSync(dirname(font), { recursive: true });
      fs.copyFileSync(resolve(workspace, 'netlify/assets/fonts/DejaVuSans.ttf'), font);
      const output = resolve(root, '.netlify/functions-serve/generate-pdf/index.mjs');
      // Browser-selection tests simulate Linux; the local compiler needs the real host.
      vi.spyOn(process, 'platform', 'get').mockReturnValue(hostPlatform);
      await build({
        entryPoints: [resolve(workspace, 'netlify/functions/generate-pdf.ts')], outfile: output,
        bundle: true, platform: 'node', format: 'esm', packages: 'external',
        plugins: [{ name: 'local-auth-fixture', setup(builder) {
          builder.onResolve({ filter: /\/lib\/(rate-limiter|supabase-client)\.js$/ }, args => ({ path: args.path, namespace: 'fixture' }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.includes('rate-limiter')
            ? 'export const withRateLimit = (name, handler) => handler;'
            : 'export const getSupabaseClient = () => ({auth:{getUser:async () => ({data:{user:{id:"local-fixture"}},error:null})}});' }));
        } }],
      });
      vi.spyOn(process, 'cwd').mockReturnValue(root);
      const { handler } = await import(pathToFileURL(output).href) as { handler: Handler };
      const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer local-fixture' }, body: JSON.stringify(request) } as unknown as HandlerEvent, {} as HandlerContext, () => {});
      expect(response).toMatchObject({ statusCode: 200, isBase64Encoded: true });
      expect(readFont).toHaveBeenCalledWith(font);
      expect(launch).not.toHaveBeenCalled();
      expect(fs.readFileSync(resolve(workspace, 'netlify.toml'), 'utf8')).toContain('included_files = ["netlify/assets/fonts/DejaVuSans.ttf", "netlify/assets/fonts/LICENSE.txt"]');
    } finally {
      // Delete only the unique bundle fixture directory just created under scratchParent.
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
