/**
 * SSRF-guarded outbound HTTP fetch for user-supplied URLs (job-URL import).
 *
 * Arbitrary URL fetching is security-sensitive. This module enforces:
 *   - http/https only, default ports only, no credentials in the URL
 *   - hostname denylist (localhost, *.local, *.internal, home.arpa)
 *   - private/loopback/link-local/CGNAT/multicast/reserved IP rejection
 *   - DNS validation AT CONNECTION TIME via a custom `lookup` (rebinding-safe:
 *     the address that is validated is the address the socket connects to)
 *   - manual redirect following with every hop re-validated
 *   - overall deadline and a hard response-size cap
 *   - text-only content types
 *
 * Zero dependencies — node:http/https/dns/net only (Netlify functions, Node 20).
 */
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';

type ErrnoLike = Error & { code?: string };

export type SafeFetchFailure =
  | 'invalid_url'
  | 'blocked_private'
  | 'unreachable'
  | 'timeout'
  | 'too_large'
  | 'not_html'
  | 'too_many_redirects';

const SAFE_FETCH_STATUS: Record<SafeFetchFailure, number> = {
  invalid_url: 400,
  blocked_private: 403,
  unreachable: 502,
  timeout: 504,
  too_large: 413,
  not_html: 415,
  too_many_redirects: 508,
};

export class SafeFetchError extends Error {
  readonly status: number;
  readonly code: SafeFetchFailure;
  readonly reason: SafeFetchFailure;

  constructor(reason: SafeFetchFailure, message?: string) {
    super(message ?? reason);
    this.name = 'SafeFetchError';
    this.status = SAFE_FETCH_STATUS[reason];
    this.code = reason;
    this.reason = reason;
  }
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

/** True for any address that must never be fetched (private/loopback/link-local/…). */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true; // not a valid address — never connect

  if (version === 4) {
    const octets = ip.split('.').map(Number);
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;            // this-net, private, loopback
    if (a === 100 && b >= 64 && b <= 127) return true;            // CGNAT 100.64/10
    if (a === 169 && b === 254) return true;                      // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;             // private 172.16/12
    if (a === 192 && b === 0 && (octets[2] === 0 || octets[2] === 2)) return true; // IETF, TEST-NET-1
    if (a === 192 && b === 168) return true;                      // private
    if (a === 198 && (b === 18 || b === 19)) return true;         // benchmarking 198.18/15
    if (a === 198 && b === 51 && octets[2] === 100) return true;  // TEST-NET-2
    if (a === 203 && b === 0 && octets[2] === 113) return true;   // TEST-NET-3
    if (a >= 224) return true;                                    // multicast + reserved + broadcast
    return false;
  }

  let lower = ip.toLowerCase();
  try {
    // URL applies the same IPv6 canonicalization used for literal URL hosts.
    lower = new URL(`http://[${lower}]/`).hostname.slice(1, -1);
  } catch {
    return true;
  }

  // IPv4-compatible and IPv4-mapped forms are canonicalized to two hex
  // hextets (for example ::ffff:127.0.0.1 -> ::ffff:7f00:1). Validate the
  // embedded address through the IPv4 rules before allowing the connection.
  const embeddedV4 = lower.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (embeddedV4) {
    const high = Number.parseInt(embeddedV4[1], 16);
    const low = Number.parseInt(embeddedV4[2], 16);
    return isPrivateAddress([
      high >>> 8,
      high & 0xff,
      low >>> 8,
      low & 0xff,
    ].join('.'));
  }
  if (lower.startsWith('64:ff9b')) return true;                   // NAT64 well-known prefix
  if (lower === '::' || lower === '::1') return true;             // unspecified, loopback
  if (/^f[cd]/.test(lower)) return true;                          // unique-local fc00::/7
  if (/^fe[89ab]/.test(lower)) return true;                       // link-local fe80::/10
  if (lower.startsWith('ff')) return true;                        // multicast ff00::/8
  if (lower.startsWith('2001:db8')) return true;                  // documentation
  return false;
}

/**
 * Parse + validate a user-supplied URL. Throws SafeFetchError('invalid_url' |
 * 'blocked_private'). Returns the parsed URL on success.
 */
export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError('invalid_url');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('invalid_url', `unsupported protocol ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new SafeFetchError('invalid_url', 'credentials in URL');
  }
  // Default ports only — anything else is a classic internal-service probe.
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new SafeFetchError('blocked_private', `non-default port ${url.port}`);
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) throw new SafeFetchError('invalid_url');
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new SafeFetchError('blocked_private', `blocked host ${host}`);
  }

  // Literal IP hosts are validated immediately (hostnames at connection time).
  const literal = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (isIP(literal) !== 0 && isPrivateAddress(literal)) {
    throw new SafeFetchError('blocked_private', 'private literal address');
  }

  return url;
}

type BaseLookup = typeof dnsLookup;

/**
 * Wrap a DNS lookup so every resolved address is validated before the socket
 * connects — the defense against DNS rebinding. Exported for unit tests.
 */
export function createSafeLookup(baseLookup: BaseLookup = dnsLookup) {
  return (
    hostname: string,
    options: Record<string, unknown>,
    callback: (err: ErrnoLike | null, address: string, family: number) => void,
  ) => {
    baseLookup(hostname, { ...options, all: true } as never, (err, addresses) => {
      if (err) return callback(err, '', 0);
      const list = Array.isArray(addresses)
        ? addresses
        : [{ address: String(addresses), family: 4 }];
      if (list.length === 0) {
        return callback(Object.assign(new Error('no addresses'), { code: 'ENOTFOUND' }), '', 0);
      }
      for (const entry of list) {
        if (isPrivateAddress(entry.address)) {
          return callback(
            Object.assign(new SafeFetchError('blocked_private', `resolved to ${entry.address}`), { code: 'EBLOCKED' }),
            '',
            0,
          );
        }
      }
      callback(null, list[0].address, list[0].family);
    });
  };
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  /** Test hook: DNS base lookup used by the connection-time validator. */
  lookup?: BaseLookup;
  /** Test hook: replaces the single-request transport entirely. */
  _requestOnce?: (
    url: URL,
    headers: Record<string, string>,
    signal: AbortSignal,
  ) => Promise<SingleResponse>;
}

export interface SingleResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  /** Reads the body with a byte cap; throws SafeFetchError('too_large') beyond it. */
  readBody: (maxBytes: number) => Promise<string>;
  abort: () => void;
}

export interface SafeFetchResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  finalUrl: string;
  redirects: string[];
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const TEXT_CONTENT_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain'];

function defaultRequestOnce(lookup: BaseLookup | undefined) {
  return (url: URL, headers: Record<string, string>, signal: AbortSignal): Promise<SingleResponse> =>
    new Promise((resolve, reject) => {
      const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = requestFn(
        url,
        {
          method: 'GET',
          headers,
          // Connection-time IP validation — the rebinding-safe core of the guard.
          lookup: createSafeLookup(lookup) as never,
          signal,
        },
        (res: IncomingMessage) => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            abort: () => res.destroy(),
            readBody: (maxBytes: number) =>
              new Promise<string>((resolveBody, rejectBody) => {
                const chunks: Buffer[] = [];
                let received = 0;
                res.on('data', (chunk: Buffer) => {
                  received += chunk.length;
                  if (received > maxBytes) {
                    res.destroy();
                    rejectBody(new SafeFetchError('too_large'));
                    return;
                  }
                  chunks.push(chunk);
                });
                res.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
                res.on('error', (err) => rejectBody(err));
              }),
          });
        },
      );
      req.on('error', (err) => {
        reject(err instanceof SafeFetchError ? err : Object.assign(err, { safeFetchTransport: true }));
      });
      req.end();
    });
}

/**
 * Fetch a user-supplied URL with the full SSRF guard. Throws SafeFetchError for
 * every failure class; never returns redirect responses (they are followed with
 * per-hop re-validation, up to maxRedirects).
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const {
    timeoutMs = 8000,
    maxBytes = 2 * 1024 * 1024,
    maxRedirects = 3,
    headers = {},
    lookup,
    _requestOnce,
  } = options;

  const requestOnce = _requestOnce ?? defaultRequestOnce(lookup);
  const abortController = new AbortController();
  let activeResponse: SingleResponse | undefined;

  const abortActiveRequest = () => {
    abortController.abort();
    const response = activeResponse;
    activeResponse = undefined;
    response?.abort();
  };

  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    deadlineTimer = setTimeout(() => {
      abortActiveRequest();
      reject(new SafeFetchError('timeout'));
    }, timeoutMs);
  });

  const run = async (): Promise<SafeFetchResult> => {
    let currentUrl = assertPublicHttpUrl(rawUrl);
    const redirects: string[] = [];

    for (let hop = 0; ; hop++) {
      const response = await requestOnce(currentUrl, {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        ...headers,
      }, abortController.signal);
      activeResponse = response;

      if (abortController.signal.aborted) {
        abortActiveRequest();
        throw new SafeFetchError('timeout');
      }

      if (REDIRECT_CODES.has(response.statusCode)) {
        response.abort();
        activeResponse = undefined;
        const location = response.headers.location;
        const target = Array.isArray(location) ? location[0] : location;
        if (!target) throw new SafeFetchError('unreachable', 'redirect without location');
        if (hop >= maxRedirects) throw new SafeFetchError('too_many_redirects');
        // Every hop is re-validated — a public page redirecting into an internal
        // address is rejected exactly like a direct request would be.
        currentUrl = assertPublicHttpUrl(new URL(target, currentUrl).toString());
        redirects.push(currentUrl.toString());
        continue;
      }

      const rawContentType = response.headers['content-type'];
      const contentType = (Array.isArray(rawContentType) ? rawContentType[0] : rawContentType ?? '').toLowerCase();
      if (contentType && !TEXT_CONTENT_TYPES.some((allowed) => contentType.startsWith(allowed))) {
        response.abort();
        activeResponse = undefined;
        throw new SafeFetchError('not_html', `content-type ${contentType.split(';')[0]}`);
      }

      const body = await response.readBody(maxBytes);
      activeResponse = undefined;
      return {
        status: response.statusCode,
        headers: response.headers,
        body,
        finalUrl: currentUrl.toString(),
        redirects,
      };
    }
  };

  try {
    return await Promise.race([run(), deadline]);
  } catch (error) {
    abortActiveRequest();
    if (error instanceof SafeFetchError) throw error;
    const code = (error as ErrnoLike | undefined)?.code;
    if (code === 'EBLOCKED') throw new SafeFetchError('blocked_private');
    if (code === 'ETIMEDOUT' || code === 'ABORT_ERR') throw new SafeFetchError('timeout');
    throw new SafeFetchError('unreachable', code ?? 'network error');
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
}
