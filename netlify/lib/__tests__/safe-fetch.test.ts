import { describe, expect, it, vi } from 'vitest';
import {
  SafeFetchError,
  assertPublicHttpUrl,
  createSafeLookup,
  isPrivateAddress,
  safeFetch,
  type SingleResponse,
} from '../safe-fetch.js';

const expectReason = (fn: () => unknown, reason: string) => {
  try {
    fn();
    throw new Error('expected SafeFetchError');
  } catch (error) {
    expect(error).toBeInstanceOf(SafeFetchError);
    expect((error as SafeFetchError).reason).toBe(reason);
  }
};

describe('isPrivateAddress', () => {
  it.each([
    '0.0.0.0', '10.0.0.1', '10.255.255.255', '100.64.0.1', '100.127.255.254',
    '127.0.0.1', '127.8.8.8', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.0.0.1', '192.0.2.10', '192.168.1.1', '198.18.0.1', '198.19.255.255',
    '198.51.100.7', '203.0.113.9', '224.0.0.1', '240.0.0.1', '255.255.255.255',
  ])('blocks IPv4 %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '104.16.1.1', '172.15.0.1', '172.32.0.1', '100.128.0.1', '198.20.0.1'])(
    'allows public IPv4 %s',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it.each([
    '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', 'ff02::1',
    '2001:db8::1', '::ffff:10.0.0.1', '::ffff:192.168.1.1', '::ffff:7f00:1',
    '::7f00:1', '64:ff9b::a00:1',
  ])('blocks IPv6 %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['2606:4700::1111', '2a00:1450:4001:80b::200e', '::ffff:8.8.8.8'])('allows public IPv6 %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it('treats invalid addresses as blocked', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
  });
});

describe('assertPublicHttpUrl', () => {
  it('accepts normal public http/https URLs', () => {
    expect(assertPublicHttpUrl('https://www.linkedin.com/jobs/view/123/').hostname).toBe('www.linkedin.com');
    expect(assertPublicHttpUrl('http://example.com/careers').protocol).toBe('http:');
    expect(assertPublicHttpUrl('https://example.com:443/x').hostname).toBe('example.com');
  });

  it.each(['ftp://example.com/x', 'file:///etc/passwd', 'gopher://example.com', 'javascript:alert(1)', 'not a url', ''])(
    'rejects %s as invalid_url',
    (url) => {
      expectReason(() => assertPublicHttpUrl(url), 'invalid_url');
    },
  );

  it('rejects credentials in the URL', () => {
    expectReason(() => assertPublicHttpUrl('https://user:pass@example.com/'), 'invalid_url');
  });

  it.each([
    'http://localhost/health',
    'https://foo.localhost/x',
    'https://printer.local/x',
    'https://vault.internal/secrets',
    'https://router.home.arpa/',
    'https://example.com./x'.replace('example.com.', 'localhost.'),
  ])('rejects internal hostname %s', (url) => {
    expectReason(() => assertPublicHttpUrl(url), 'blocked_private');
  });

  it.each([
    'http://127.0.0.1/x',
    'http://10.1.2.3/x',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/x',
    'http://[fd00::1]/x',
    'http://[::ffff:127.0.0.1]/x',
    'http://[::ffff:7f00:1]/x',
    'http://[::127.0.0.1]/x',
  ])('rejects private literal address %s', (url) => {
    expectReason(() => assertPublicHttpUrl(url), 'blocked_private');
  });

  it('rejects non-default ports', () => {
    expectReason(() => assertPublicHttpUrl('https://example.com:8080/x'), 'blocked_private');
    expectReason(() => assertPublicHttpUrl('http://example.com:6379/x'), 'blocked_private');
  });
});

describe('createSafeLookup (connection-time DNS validation)', () => {
  const lookupWith = (addresses: Array<{ address: string; family: number }>) =>
    ((_host: string, _opts: unknown, cb: (err: unknown, addrs: unknown) => void) => {
      cb(null, addresses);
    }) as never;

  it('rejects hostnames resolving to a private address (any record)', async () => {
    const safeLookup = createSafeLookup(lookupWith([
      { address: '104.16.1.1', family: 4 },
      { address: '10.0.0.5', family: 4 }, // rebinding/split-horizon record
    ]));

    const result = await new Promise<{ err: Error | null }>((resolve) => {
      safeLookup('evil.example.com', {}, (err) => resolve({ err }));
    });
    expect(result.err).toBeInstanceOf(SafeFetchError);
    expect((result.err as SafeFetchError).reason).toBe('blocked_private');
  });

  it('passes through fully public resolutions', async () => {
    const safeLookup = createSafeLookup(lookupWith([{ address: '104.16.1.1', family: 4 }]));
    const result = await new Promise<{ err: unknown; address: string }>((resolve) => {
      safeLookup('example.com', {}, (err, address) => resolve({ err, address }));
    });
    expect(result.err).toBeNull();
    expect(result.address).toBe('104.16.1.1');
  });
});

describe('safeFetch', () => {
  const response = (over: Partial<SingleResponse> & { body?: string } = {}): SingleResponse => ({
    statusCode: over.statusCode ?? 200,
    headers: over.headers ?? { 'content-type': 'text/html; charset=utf-8' },
    abort: over.abort ?? vi.fn(),
    readBody: over.readBody ?? (async () => over.body ?? '<html>ok</html>'),
  });

  it('returns the final body and URL for a plain 200', async () => {
    const requestOnce = vi.fn(async () => response({ body: '<html>job page</html>' }));
    const result = await safeFetch('https://example.com/job', { _requestOnce: requestOnce });
    expect(result.status).toBe(200);
    expect(result.body).toContain('job page');
    expect(result.finalUrl).toBe('https://example.com/job');
    expect(result.redirects).toEqual([]);
  });

  it('follows redirects, re-validating every hop', async () => {
    const requestOnce = vi.fn()
      .mockResolvedValueOnce(response({ statusCode: 302, headers: { location: 'https://boards.example.org/posting/9' } }))
      .mockResolvedValueOnce(response({ body: '<html>final</html>' }));

    const result = await safeFetch('https://example.com/job', { _requestOnce: requestOnce });
    expect(result.finalUrl).toBe('https://boards.example.org/posting/9');
    expect(result.redirects).toEqual(['https://boards.example.org/posting/9']);
  });

  it('rejects a redirect into a private address', async () => {
    const requestOnce = vi.fn(async () =>
      response({ statusCode: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }),
    );
    await expect(safeFetch('https://example.com/job', { _requestOnce: requestOnce }))
      .rejects.toMatchObject({ reason: 'blocked_private' });
  });

  it('rejects a redirect into an internal hostname', async () => {
    const requestOnce = vi.fn(async () =>
      response({ statusCode: 301, headers: { location: 'https://vault.internal/creds' } }),
    );
    await expect(safeFetch('https://example.com/job', { _requestOnce: requestOnce }))
      .rejects.toMatchObject({ reason: 'blocked_private' });
  });

  it('stops after maxRedirects hops', async () => {
    const requestOnce = vi.fn(async (url: URL) =>
      response({ statusCode: 302, headers: { location: `${url.origin}/next` } }),
    );
    await expect(safeFetch('https://example.com/job', { _requestOnce: requestOnce, maxRedirects: 2 }))
      .rejects.toMatchObject({ reason: 'too_many_redirects' });
  });

  it('propagates the body size cap', async () => {
    const requestOnce = vi.fn(async () =>
      response({
        readBody: async (maxBytes: number) => {
          throw new SafeFetchError('too_large', `over ${maxBytes}`);
        },
      }),
    );
    await expect(safeFetch('https://example.com/job', { _requestOnce: requestOnce, maxBytes: 1024 }))
      .rejects.toMatchObject({ reason: 'too_large' });
  });

  it('rejects non-text content types before reading the body', async () => {
    const readBody = vi.fn();
    const requestOnce = vi.fn(async () =>
      response({ headers: { 'content-type': 'application/pdf' }, readBody }),
    );
    await expect(safeFetch('https://example.com/file.pdf', { _requestOnce: requestOnce }))
      .rejects.toMatchObject({ reason: 'not_html' });
    expect(readBody).not.toHaveBeenCalled();
  });

  it('times out against a hanging server', async () => {
    let requestSignal: AbortSignal | undefined;
    const requestOnce = vi.fn((_url: URL, _headers: Record<string, string>, signal: AbortSignal) => {
      requestSignal = signal;
      return new Promise<SingleResponse>(() => { /* never settles */ });
    });
    await expect(safeFetch('https://example.com/slow', { _requestOnce: requestOnce, timeoutMs: 60 }))
      .rejects.toMatchObject({ reason: 'timeout' });
    expect(requestSignal?.aborted).toBe(true);
  });

  it('aborts an active response when the body read exceeds the deadline', async () => {
    const abort = vi.fn();
    const requestOnce = vi.fn(async () => response({
      abort,
      readBody: () => new Promise<string>(() => { /* never settles */ }),
    }));

    await expect(safeFetch('https://example.com/slow-body', { _requestOnce: requestOnce, timeoutMs: 60 }))
      .rejects.toMatchObject({ reason: 'timeout' });
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('validates the initial URL before any request is made', async () => {
    const requestOnce = vi.fn();
    await expect(safeFetch('http://127.0.0.1/x', { _requestOnce: requestOnce }))
      .rejects.toMatchObject({ reason: 'blocked_private' });
    expect(requestOnce).not.toHaveBeenCalled();
  });
});
