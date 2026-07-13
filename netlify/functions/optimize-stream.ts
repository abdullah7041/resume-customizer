/**
 * optimize-stream.ts — Netlify Functions v2 SSE Endpoint
 * 
 * Streams resume optimization progress to the client via Server-Sent Events.
 * Uses the standard Web Request/Response API (Functions v2 syntax).
 * 
 * Stream order:
 *   1. event: status  → { phase: "validating" }
 *   2. event: status  → { phase: "detecting_vulnerabilities", count: N }
 *   3. event: status  → { phase: "ai_processing" }
 *   4. event: result  → Full optimization JSON payload
 *   5. event: done    → { success: true, durationMs }
 *   6. event: error   → { error, retryable } (on failure)
 */

import { optimizeResume } from "../lib/gemini-client.js";
import { OptimizeRequestSchema, formatZodError } from "../lib/resume-schemas.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";
import { FEATURE_COSTS, addCredits, checkCredits, consumeCredits } from "../lib/credit-manager.js";
import { detectVulnerabilities } from "../lib/vulnerability-detector.js";
import { buildCacheKey, getCached, setCached } from "../lib/redis-cache.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { checkFreePreviewRateLimitForRequest, checkRateLimitForRequest } from "../lib/rate-limiter.js";
import { normalizeEstimatedImprovement, normalizeScore, scoreFromCategoryScores } from "../lib/score-utils.js";
import { MODELS } from "../lib/model-registry.js";

// NOTE: Previously used an inline require("@supabase/supabase-js") which fails
// in esbuild production bundles. Now uses the shared static import instead.

initSentry();

const OPTIMIZE_CACHE_TTL_SECONDS = 600;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Format a single SSE event */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

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

function hasRenderableCards(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const cards = (value as { cards?: unknown }).cards;
  return Array.isArray(cards) && cards.length > 0;
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

  const rateLimit = await checkRateLimitForRequest(request, "optimize-stream");
  if (!rateLimit.allowed && rateLimit.response) {
    return rateLimit.response;
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
  const freePreview = rawBody.freePreview === true;

  // --- Auth ---
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  let user: any = null;
  let userEmail: string | undefined;

  if (!freePreview && !authHeader) {
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

  const ipAddress = getClientIPFromRequest(request);
  const emailVerified = user?.email_confirmed_at !== null || (user as any)?.email_verified !== false;

  if (freePreview && rawBody.cacheOnly !== true) {
    const previewLimit = await checkFreePreviewRateLimitForRequest(request, "optimize-free-preview", user?.id || userEmail);
    if (!previewLimit.allowed && previewLimit.response) {
      return previewLimit.response;
    }
  }

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
  const cacheKey = buildCacheKey('optimize', {
    userId: user?.id || userEmail || `free-preview:${ipAddress || 'unknown'}`,
    resumeText: resumeText.trim(),
    jobText: jobText.trim(),
    language: language || 'en',
    vulnerabilities: vulnerabilities.map((v: any) => v.type).sort(),
    userClarifications: userClarifications || '',
    userHardStops: userHardStops || [],
  });

  const cachedResponse = await getCached<Record<string, unknown>>(cacheKey);
  if (hasRenderableCards(cachedResponse)) {
    console.log('[optimize-stream] Cache HIT — returning cached JSON (no credit deduction).');
    return new Response(JSON.stringify(cachedResponse), {
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
  if (cacheOnly) {
    console.log('[optimize-stream] Cache-only recovery MISS — no credit deduction.');
    return new Response(
      JSON.stringify({
        error: 'No cached optimization result is available yet.',
        cacheOnlyMiss: true,
      }),
      {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      },
    );
  }
  console.log('[optimize-stream] Cache MISS — running credit check and SSE stream.');

  // --- Credit check (after cache check so cached retries bypass this) ---
  const creditCheck = freePreview || !userEmail
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

  // --- Stream the optimization ---
  const encoder = new TextEncoder();
  const startTime = Date.now();
  let creditsConsumed = false;
  let resultDelivered = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Phase 1: Validating
        controller.enqueue(encoder.encode(sseEvent("status", { phase: "validating" })));

        // Phase 2: Vulnerability detection (already done above, just emit status)
        controller.enqueue(
          encoder.encode(
            sseEvent("status", {
              phase: "detecting_vulnerabilities",
              count: vulnerabilities.length,
              types: vulnerabilities.map((v: any) => v.type),
            })
          )
        );

        // Phase 3: AI Processing (this is the long step)
        controller.enqueue(encoder.encode(sseEvent("status", { phase: "ai_processing" })));

        const optimization = await optimizeResume(resumeText, jobText, language, vulnerabilities, userClarifications, userHardStops, {
          featureName: "optimize_stream",
        });

        const aiDuration = Date.now() - startTime;
        console.log(`[optimize-stream] AI call took ${aiDuration}ms`);

        if (!optimization) {
          controller.enqueue(
            encoder.encode(
              sseEvent("error", {
                error: "AI optimization failed to generate suggestions. Please try with a shorter resume or job description.",
                retryable: true,
              })
            )
          );
          controller.close();
          return;
        }

        // Phase 4: Build response (reuses the same card-mapping logic as optimize.ts)
        controller.enqueue(encoder.encode(sseEvent("status", { phase: "building_response" })));

        const cards = buildOptimizationCards(optimization);
        const { beforeScore, estimatedImprovement } = calculateScores(optimization, cards);

        const addKeywords = optimization?.missing_keywords || [];
        const matchedKeywords = optimization?.keywords_to_keep || [];
        const jdKeywords = [...matchedKeywords, ...addKeywords]
          .filter((k: string, i: number, arr: string[]) => arr.indexOf(k) === i);

        // Consume credits after successful optimization
        let creditResult: { creditsRemaining: number | null };
        if (freePreview || !userEmail) {
          creditResult = { creditsRemaining: null };
        } else {
          const consumption = await consumeCredits(userEmail, "optimize");
          creditsConsumed = consumption.success;
          creditResult = consumption;
        }

        const resultPayload = {
          cards,
          keywords: {
            add: addKeywords,
            neutral: optimization?.keywords_to_keep || [],
            remove: optimization?.keywords_to_avoid || [],
          },
          matchScoring: {
            beforeScore: Math.round(beforeScore),
            estimatedImprovement: Math.round(estimatedImprovement),
            jdKeywords: jdKeywords.slice(0, 20),
            matchedKeywords: matchedKeywords.slice(0, 15),
            reasoning: null,
          },
          creditsRemaining: creditResult.creditsRemaining,
          freePreview,
          gapAnalysis: (optimization?.gap_analysis || []).map((gap: any) => ({
            requirement: gap.requirement || "",
            currentState: gap.current_state || "",
            severity: gap.gap_severity || "minor",
            recommendation: gap.recommendation || "",
          })),
          keywordStrategy: { mirroredPhrases: [], structuralChanges: [], hiddenMatches: [] },
          categoryScores: optimization?.category_scores || null,
          positionSuggestion: optimization?.position_name_suggestion
            ? {
                ...optimization.position_name_suggestion,
                positionChanges: (optimization.position_name_suggestion.position_changes || []).map(
                  (c: { original: string; suggested: string; change_needed: boolean }) => ({
                    original: c.original,
                    suggested: c.suggested,
                    change_needed: c.change_needed,
                  })
                ),
              }
            : null,
          projectImprovements: (optimization?.project_improvements || []).map((proj: any) => ({
            project_name: proj.project_name || "",
            original: proj.original || "",
            improved: proj.improved || "",
            issue: proj.issue || "",
            rationale: proj.rationale || "",
          })),
          certificationRecommendations: (optimization?.certification_recommendations || []).map(
            (cert: any) => ({
              name: cert.name || "",
              issuer: cert.issuer || "",
              relevance: cert.relevance || "",
            })
          ),
          scoreBreakdown: null,
          source: "gemini",
          debug: {
            totalCards: cards.length,
            hasOptimization: !!optimization,
            hadBulletImprovements: (optimization?.bullet_improvements?.length || 0) > 0,
            hasJobDescription: Boolean(jobText?.trim()),
            streamed: true,
            model: MODELS.flash,
            latencyMs: Date.now() - startTime,
          },
        };

        // Cache briefly because optimization cards can include resume snippets.
        await setCached(cacheKey, resultPayload, OPTIMIZE_CACHE_TTL_SECONDS);
        console.log('[optimize-stream] Cache SET for key:', cacheKey.substring(0, 50));

        // Send the full result as a single SSE event
        controller.enqueue(encoder.encode(sseEvent("result", resultPayload)));
        resultDelivered = true;

        // Signal completion
        controller.enqueue(
          encoder.encode(
            sseEvent("done", { success: true, durationMs: Date.now() - startTime })
          )
        );
      } catch (error: any) {
        console.error("[optimize-stream] Error:", summarizeErrorForLog(error));

        if (creditsConsumed && !resultDelivered && userEmail) {
          try {
            await addCredits(userEmail, FEATURE_COSTS.optimize, "refund", {
              feature: "optimize",
              reason: "result_delivery_failed",
            });
            creditsConsumed = false;
          } catch (refundError) {
            console.error(
              "[optimize-stream] Failed to restore credits:",
              summarizeErrorForLog(refundError)
            );
            captureError(refundError, {
              function: "optimize-stream-credit-refund",
            });
          }
        }

        captureError(error, {
          function: "optimize-stream",
          payload: {
            resumeTextLength: resumeText?.length || 0,
            jobTextLength: jobText?.length || 0,
          },
        });

        const isTimeout =
          error?.name === "TimeoutError" || error?.status === 504;

        controller.enqueue(
          encoder.encode(
            sseEvent("error", {
              error: isTimeout
                ? "Optimization timed out. Retrying automatically..."
                : "Failed to optimize resume",
              retryable: isTimeout,
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ============================================
// Card building logic (mirrors optimize.ts exactly)
// ============================================

function hasContent(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function getString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

function buildOptimizationCards(optimization: any) {
  const cards: Array<{
    section: string;
    issue: string;
    suggestion: string;
    exampleBefore: string;
    exampleAfter: string;
  }> = [];

  // Headline
  const suggestedHeadline = optimization?.suggested_headline || null;
  const originalHeadline = optimization?.original_headline || null;
  if (hasContent(suggestedHeadline) && hasContent(originalHeadline)) {
    cards.push({
      section: "Headline",
      issue: "Headline could be more targeted.",
      suggestion: "Align headline with the job title and key requirements.",
      exampleBefore: getString(originalHeadline, "Current headline not available"),
      exampleAfter: getString(suggestedHeadline, ""),
    });
  }

  // Summary
  const summaryRewrite = optimization?.summary_rewrite || null;
  const originalSummary = optimization?.original_summary || null;
  if (hasContent(summaryRewrite) && hasContent(originalSummary)) {
    cards.push({
      section: "Summary",
      issue: "Summary could be more action-oriented.",
      suggestion: "Rewrite summary to better align with the job description.",
      exampleBefore: getString(originalSummary, "Original summary not available"),
      exampleAfter: getString(summaryRewrite, ""),
    });
  }

  // Experience bullets
  // Optional `source_span` (verbatim grounding phrase) rides along on each
  // bullet_improvement; the card type omits it, so it is safely ignored here and
  // remains available on the raw optimization object for a future hover-proof UX.
  const bulletImprovements = optimization?.bullet_improvements || [];
  if (bulletImprovements.length > 0) {
    bulletImprovements.forEach(
      (item: {
        original?: string;
        improved?: string;
        suggestion?: string;
        issue?: string;
        rationale?: string;
      }) => {
        const originalText = item.original;
        const improvedText = item.improved || item.suggestion;

        const isNAResponse =
          typeof improvedText === "string" &&
          (improvedText.trim().toLowerCase().startsWith("n/a") ||
            improvedText.toLowerCase().includes("not relevant to the target role") ||
            improvedText.toLowerCase().includes("not relevant to this role"));

        if (hasContent(originalText) && hasContent(improvedText) && !isNAResponse) {
          cards.push({
            section: "Experience",
            issue: item.issue || "Bullet point lacks impact.",
            suggestion: item.rationale || "Use stronger action verbs and metrics.",
            exampleBefore: getString(originalText, "Original not provided"),
            exampleAfter: getString(improvedText, "Improvement not provided"),
          });
        }
      }
    );
  }

  // Skills
  const skillsToAdd = optimization?.missing_keywords || [];
  if (skillsToAdd.length > 0) {
    cards.push({
      section: "Skills",
      issue: "Consider adding these skills if you have them.",
      suggestion:
        "If you have experience with these skills, consider adding them to improve ATS matching. Only add skills you actually possess.",
      exampleBefore: "Current resume skills",
      exampleAfter: `Consider: ${skillsToAdd.slice(0, 8).join(", ")}${skillsToAdd.length > 8 ? "..." : ""}`,
    });
  }

  // Fallback
  if (cards.length === 0) {
    console.warn("[optimize-stream] No cards generated, adding fallback guidance");
    const missingKeywords = optimization?.missing_keywords || [];
    if (missingKeywords.length > 0) {
      cards.push({
        section: "Skills",
        issue: "Missing keywords detected",
        suggestion: "Add these skills if you have them: " + missingKeywords.slice(0, 5).join(", "),
        exampleBefore: "Current resume skills",
        exampleAfter: "Add relevant skills from job description",
      });
    } else {
      cards.push({
        section: "General",
        issue: "AI optimization incomplete",
        suggestion:
          "The AI couldn't generate specific improvements. Try with a clearer job description or check resume formatting.",
        exampleBefore: "Your current resume",
        exampleAfter: "Consider manual review or retry",
      });
    }
  }

  return cards;
}

function calculateScores(optimization: any, cards: any[]) {
  let beforeScore: number | null = null;
  if (optimization?.match_score != null) {
    beforeScore = normalizeScore(optimization.match_score, "match_score");
  }

  if (beforeScore === null && optimization?.category_scores) {
    beforeScore = scoreFromCategoryScores(optimization.category_scores);
    console.log("[optimize-stream] Calculated match_score from category_scores:", beforeScore);
  }

  if (beforeScore === null) {
    throw new Error("AI optimization failed to calculate match score");
  }

  const fallbackImprovement = Math.min(cards.length * 2, 15);
  const estimatedImprovement = normalizeEstimatedImprovement(beforeScore, optimization?.after_score, fallbackImprovement);

  return { beforeScore, estimatedImprovement };
}

// Export config for Netlify Functions v2
export const config = {
  path: "/api/optimize-stream",
};
