/**
 * Authenticated optimization dispatcher and read-only result lookup.
 * Retains the existing route while generation runs in a native background worker.
 * Returns 202 while pending, validated JSON on success, or a billing-aware error.
 */

import { OptimizeRequestSchema, formatZodError } from "../lib/resume-schemas.js";
import { initSentry, captureError } from "../lib/sentry.js";
import {
  checkCredits,
  isEmailVerified,
} from "../lib/credit-manager.js";
import { detectVulnerabilities } from "../lib/vulnerability-detector.js";
import { buildOptimizeCacheKey, getCached } from "../lib/redis-cache.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { checkRateLimitForRequest } from "../lib/rate-limiter.js";
import { hasCurrentEvidenceCards } from "../lib/optimize-cards.js";
import { claimOptimizationJob, dispatchOptimizationJob, newOptimizationJob, optimizationJobPayload, readOptimizationJob } from "../lib/optimization-jobs.js";

// NOTE: Previously used an inline require("@supabase/supabase-js") which fails
// in esbuild production bundles. Now uses the shared static import instead.

initSentry();

/**
 * Extract client IP from standard Request headers.
 */
function getClientIPFromRequest(request: Request): string | null {
  const headers = request.headers;
  const ipHeaders = [
    "x-nf-client-connection-ip",
    "x-forwarded-for",
    "x-real-ip",
    "client-ip",
  ];
  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      return value.split(",")[0].trim();
    }
  }
  return null;
}

async function attachLiveCredits<T extends Record<string, unknown>>(
  payload: T,
  userEmail: string | undefined,
  freePreview: boolean,
): Promise<T & { creditsRemaining: number | null }> {
  if (freePreview || !userEmail) return { ...payload, creditsRemaining: null };
  try {
    const check = await checkCredits(userEmail, "optimize");
    return { ...payload, creditsRemaining: check.available };
  } catch {
    return { ...payload, creditsRemaining: null };
  }
}

export default async function handler(request: Request): Promise<Response> {
  // --- CORS preflight ---
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Parse & validate body ---
  let rawBody: any;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const freePreviewRequested = rawBody.freePreview === true;
  const rateLimit = await checkRateLimitForRequest(request, rawBody.cacheOnly === true ? 'optimize-status' : 'optimize-stream');
  if (!rateLimit.allowed && rateLimit.response) return rateLimit.response;

  // --- Auth ---
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  let user: any = null;
  let userEmail: string | undefined;

  if (!freePreviewRequested && !authHeader) {
    return new Response(
      JSON.stringify({ error: "Authentication required. Please sign in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabase = getSupabaseClient();
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Server configuration error. Please contact support." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    user = authUser;
    userEmail = authUser.email;
  }

  // `freePreview` is a claim made by the client, not an authorization.
  //
  // The client sent it for SIGNED-IN users whenever a localStorage counter was
  // under three, so the guest limiter answered paying customers with 429
  // `guest/free-preview-used` ("You've used your free preview... Please sign in")
  // and no credit was ever consumed — Sentry JAVASCRIPT-REACT-1H, preview_mode
  // true on a signed-in session. The claim is honoured ONLY for a caller we could
  // not authenticate at all; an authenticated request always goes through billing.
  const freePreview = freePreviewRequested && !user;

  // An authenticated account with no email cannot be billed, so serving it for
  // free was a bypass rather than a kindness. Google OAuth is the only sign-in
  // path and always yields an email, so this branch means something is wrong.
  if (user && !userEmail) {
    return new Response(
      JSON.stringify({
        error: "Your account has no email address on file, so credits cannot be applied. Please contact support.",
        code: "auth/no-email",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const ipAddress = getClientIPFromRequest(request);
  const emailVerified = isEmailVerified(user);

  // The claimed worker reserves guest quota exactly once, immediately before AI.
  const parseResult = OptimizeRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({ error: formatZodError(parseResult.error) }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { resumeText, jobText, workHistory, language, userClarifications, userHardStops, cacheOnly } = parseResult.data;

  // --- Vulnerability detection (needed for both cache key and AI call) ---
  const vulnerabilities = workHistory?.length
    ? detectVulnerabilities(workHistory)
    : [];

  if (vulnerabilities.length > 0) {
    console.log(
      `[optimize-stream] Detected ${vulnerabilities.length} vulnerabilities:`,
      vulnerabilities.map((v: any) => v.type)
    );
  }

  // -----------------------------------------------------------------------
  // Cache check BEFORE credit check — enables idempotent retries.
  // If a previous request was processed but the stream failed to deliver the
  // result, the result is cached. The retry hits cache here and returns without
  // consuming additional credits, even if the user's balance is now 0.
  //
  // TODO: Add explicit operationId support so the client can pass a UUID per
  // attempt. The server would store {operationId → result} independently of
  // content hash. This covers edge cases where the content hash collides or
  // the TTL has expired before the user can retry.
  // -----------------------------------------------------------------------
  const cacheKey = buildOptimizeCacheKey({
    userScope: user?.id || userEmail || `free-preview:${ipAddress || 'unknown'}`,
    resumeText,
    jobText,
    language: language || 'en',
    vulnerabilities: vulnerabilities.map((v: { type: string }) => v.type),
    userClarifications: userClarifications || '',
    userHardStops: userHardStops || [],
  });

  const cachedResponse = await getCached<Record<string, unknown>>(cacheKey);
  if (hasCurrentEvidenceCards(cachedResponse)) {
    console.log('[optimize-stream] Cache HIT — returning cached JSON (no credit deduction).');
    const responsePayload = await attachLiveCredits(cachedResponse, userEmail, freePreview);
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  if (cachedResponse) {
    console.warn('[optimize-stream] Cache HIT had no renderable cards — regenerating.');
  }
  const jobKey = `${cacheKey}:job`;
  let job: Awaited<ReturnType<typeof readOptimizationJob>> = null;
  try {
    job = await readOptimizationJob(jobKey);
  } catch {
    return new Response(JSON.stringify({ error: 'Optimization storage is unavailable. Please try again later.', billingStateUnknown: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  if (job?.state === 'succeeded' && hasCurrentEvidenceCards(job.result)) {
    return Response.json(await attachLiveCredits(job.result, userEmail, freePreview));
  }
  if (job?.state === 'failed' && (cacheOnly || job.error?.billingStateUnknown)) {
    return Response.json({ ...job.error, jobFailed: true }, { status: job.error?.status || 500 });
  }
  if (cacheOnly) {
    return job && (job.state === 'queued' || job.state === 'running')
      ? Response.json({ pending: true }, { status: 202 })
      : Response.json({ error: 'No cached optimization result is available yet.', cacheOnlyMiss: true }, { status: 409 });
  }
  console.log('[optimize-stream] Cache MISS — preparing background optimization.');

  // --- Credit check (after cache check so cached retries bypass this) ---
  const creditCheck = job?.state === 'queued' || job?.state === 'running' || freePreview || !userEmail
    ? { hasCredits: true, required: 0, available: 0 }
    : await checkCredits(userEmail, "optimize", { ipAddress, emailVerified });
  if (!creditCheck.hasCredits) {
    return new Response(
      JSON.stringify({
        error: "Insufficient credits",
        creditsRequired: creditCheck.required,
        creditsAvailable: creditCheck.available,
        creditsNeeded: creditCheck.required - creditCheck.available,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  // -----------------------------------------------------------------------

  // Generation runs in a native background function, outside this route's 30s limit.
  // Both ordinary retries and interrupted handoffs retain the same worker ownership.
  try {
    if (job?.state === 'running') return Response.json({ pending: true }, { status: 202 });
    const body = JSON.stringify({ ...parseResult.data, freePreview: freePreviewRequested });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers.authorization = authHeader;
    if (ipAddress) headers['x-nf-client-connection-ip'] = ipAddress;
    const candidate = job?.state === 'queued' ? job : newOptimizationJob(body);
    optimizationJobPayload(jobKey, candidate, headers);
    if (await claimOptimizationJob(jobKey, candidate)) job = candidate;
    else job = await readOptimizationJob(jobKey);
    if (!job) throw Object.assign(new Error('Optimization job could not be read.'), { status: 503, code: 'optimize/job-unavailable' });
    if (job.state === 'succeeded' && hasCurrentEvidenceCards(job.result)) {
      return Response.json(await attachLiveCredits(job.result, userEmail, freePreview));
    }
    if (job.state === 'failed') return Response.json({ ...job.error, jobFailed: true }, { status: job.error?.status || 500 });
    if (job.state === 'queued') await dispatchOptimizationJob(jobKey, job, headers);
    return Response.json({ pending: true }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 413) {
      return Response.json({ error: error.message, billingStateUnknown: job?.state === 'queued' }, { status: 413 });
    }
    captureError(error, { function: 'optimize-dispatch' });
    return Response.json({ error: 'Could not queue optimization. Please retry without changing your inputs.', billingStateUnknown: true }, { status: 503 });
  }
}

export const config = { path: '/api/optimize-stream' };
