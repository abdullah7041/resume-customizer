// One HTTP helper for every ATS reader. Nothing here throws: a failure is a
// FetchOutcome with ok:false, because the crawler must be able to tell "the board
// said nothing" apart from "the board could not be reached".

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_BYTES = 4 * 1024 * 1024;

/** Only the request options these readers actually set — avoids depending on DOM lib types. */
interface RequestOptions {
  method: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
}

export interface JsonResponse {
  ok: boolean;
  status: number | null;
  body: unknown;
  error?: string;
}

async function request(url: string, init: RequestOptions, timeoutMs: number): Promise<JsonResponse> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json', 'user-agent': 'WatheqJobFeed/1.0', ...init.headers },
      redirect: 'follow',
    });

    if (response.status !== 200) {
      return { ok: false, status: response.status, body: null, error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, status: response.status, body: null, error: 'payload too large' };
    }

    try {
      return { ok: true, status: 200, body: JSON.parse(text) };
    } catch {
      return { ok: false, status: 200, body: null, error: 'non-JSON response' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed';
    return { ok: false, status: null, body: null, error: message };
  }
}

export function getJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<JsonResponse> {
  return request(url, { method: 'GET' }, timeoutMs);
}

export function postJson(
  url: string,
  payload: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<JsonResponse> {
  return request(
    url,
    { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } },
    timeoutMs,
  );
}

/** Text out of an HTML fragment, with block boundaries preserved as newlines. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Bound stored JD text — enough for matching, not a mirror of the whole posting. */
export const JD_MAX_CHARS = 12000;

export function boundDescription(text: string): string {
  return text.slice(0, JD_MAX_CHARS);
}

/**
 * The shared token guard. A token is interpolated straight into provider URL
 * templates (`https://{token}.pinpointhq.com/...`), so anything that is not a
 * plain handle never reaches a fetcher.
 */
export function isPlainToken(token: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(token);
}
