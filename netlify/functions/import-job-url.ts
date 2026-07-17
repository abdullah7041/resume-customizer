/**
 * Import a job description from a public job-posting URL (LinkedIn, Greenhouse,
 * Lever, Bayt, GulfTalent, Naukrigulf, Indeed, company career pages).
 *
 *   POST /.netlify/functions/import-job-url
 *   body: { url, language? }
 *   resp: { status: 'ok', jobText, jobTitle?, companyName?, sourceUrl, finalUrl,
 *           source, confidence }
 *       | { status: 'failed', failureReason, sourceUrl, finalUrl? }
 *
 * Signed-in users authenticate with their bearer token; guests are allowed but
 * throttled per-IP (the primary persona — iPhone user pasting a LinkedIn link —
 * is often a first-time guest). Fetching is SSRF-guarded end to end
 * (netlify/lib/safe-fetch.ts) and fetch-level failures are returned as typed,
 * recoverable states — internal errors are never exposed to the client.
 */
import { Handler } from '@netlify/functions';
import { z } from 'zod';
import { withRateLimit, checkFreePreviewRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { SafeFetchError, safeFetch } from '../lib/safe-fetch.js';
import type { SafeFetchFailure } from '../lib/safe-fetch.js';
import {
  MAX_JOB_TEXT_CHARS,
  detectLoginWall,
  extractJobFromHtml,
  normalizeLinkedInUrl,
} from '../lib/job-page-extract.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';

initSentry();

const RequestSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  language: z.enum(['en', 'ar']).default('en'),
});

export type ImportFailureReason =
  | 'invalid_url'
  | 'unsupported_url'
  | 'unreachable'
  | 'login_required'
  | 'blocked'
  | 'timeout'
  | 'too_large'
  | 'not_html'
  | 'jd_not_found';

const SAFE_FETCH_FAILURE_MAP: Record<SafeFetchFailure, ImportFailureReason> = {
  invalid_url: 'invalid_url',
  blocked_private: 'blocked',
  unreachable: 'unreachable',
  timeout: 'timeout',
  too_large: 'too_large',
  not_html: 'not_html',
  too_many_redirects: 'unreachable',
};

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const failed = (sourceUrl: string, failureReason: ImportFailureReason, finalUrl?: string) =>
  json(200, { status: 'failed', failureReason, sourceUrl, ...(finalUrl ? { finalUrl } : {}) });

const baseHandler: Handler = async (event) => {
  let sourceUrl = '';
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const parseResult = RequestSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parseResult.success) {
      return json(400, { error: 'Invalid request: url is required (max 2048 chars)' });
    }
    sourceUrl = parseResult.data.url;
    const { language } = parseResult.data;

    // Signed-in via bearer token; guests allowed with a strict per-IP daily limit.
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let isAuthenticated = false;
    if (authHeader) {
      const client = getSupabaseClient();
      if (client) {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const { data, error } = await client.auth.getUser(token);
        isAuthenticated = !error && Boolean(data?.user);
      }
    }
    if (!isAuthenticated) {
      const guestLimit = await checkFreePreviewRateLimit(event, 'import-job-url-guest');
      if (!guestLimit.allowed) {
        return guestLimit.response ?? json(429, { error: 'Too many requests' });
      }
    }

    // LinkedIn collection/search links canonicalize to the public guest job page.
    const linkedIn = normalizeLinkedInUrl(sourceUrl);
    if (linkedIn.isLinkedIn && !linkedIn.canonicalUrl) {
      return failed(sourceUrl, 'unsupported_url');
    }
    const fetchUrl = linkedIn.canonicalUrl ?? sourceUrl;

    let page;
    try {
      page = await safeFetch(fetchUrl, {
        timeoutMs: 8000,
        maxBytes: 2 * 1024 * 1024,
        maxRedirects: 3,
        headers: {
          // Honest browser-class request for a public page; no cookies, no auth.
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'Accept-Language': language === 'ar' ? 'ar,en;q=0.7' : 'en;q=0.9,ar;q=0.5',
        },
      });
    } catch (error) {
      if (error instanceof SafeFetchError) {
        console.warn(`[import-job-url] fetch failed (${error.reason})`);
        return failed(sourceUrl, SAFE_FETCH_FAILURE_MAP[error.reason]);
      }
      throw error;
    }

    if (detectLoginWall(page.finalUrl, page.status, page.body)) {
      console.warn(`[import-job-url] login wall detected (status ${page.status})`);
      return failed(sourceUrl, 'login_required', page.finalUrl);
    }
    if (page.status >= 400) {
      console.warn(`[import-job-url] upstream status ${page.status}`);
      return failed(sourceUrl, page.status === 401 ? 'login_required' : 'unreachable', page.finalUrl);
    }

    const extracted = extractJobFromHtml(page.body);
    if (!extracted) {
      return failed(sourceUrl, 'jd_not_found', page.finalUrl);
    }

    console.log(`[import-job-url] ok source=${extracted.source} confidence=${extracted.confidence} textLen=${extracted.jobText.length} auth=${isAuthenticated}`);

    return json(200, {
      status: 'ok',
      jobText: extracted.jobText.slice(0, MAX_JOB_TEXT_CHARS),
      jobTitle: extracted.jobTitle,
      companyName: extracted.companyName,
      sourceUrl,
      finalUrl: page.finalUrl,
      source: extracted.source,
      confidence: extracted.confidence,
    });
  } catch (error) {
    // Never leak internal fetch/parse errors to the client.
    console.error('[import-job-url] Error:', summarizeErrorForLog(error));
    captureError(error, { function: 'import-job-url' });
    return json(200, { status: 'failed', failureReason: 'unreachable' as ImportFailureReason, sourceUrl });
  }
};

export const handler = withRateLimit('import-job-url', baseHandler);
