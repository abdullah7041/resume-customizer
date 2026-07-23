import { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { optimizeResume } from "../lib/gemini-client.js";
import { checkFreePreviewRateLimit, withRateLimit } from "../lib/rate-limiter.js";
import { OptimizeRequestSchema, formatZodError } from "../lib/resume-schemas.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";
import { checkCredits, consumeCredits, isEmailVerified } from "../lib/credit-manager.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { getClientIP } from "../lib/ip-utils.js";
import { detectVulnerabilities } from "../lib/vulnerability-detector.js";
import { buildOptimizeCacheKey, getCached, setCached } from "../lib/redis-cache.js";
import { buildOptimizationCards, calculateScores } from "../lib/optimize-cards.js";
import { MODELS } from "../lib/model-registry.js";

initSentry();

const OPTIMIZE_CACHE_TTL_SECONDS = 600;

function hasRenderableCards(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const cards = (value as { cards?: unknown }).cards;
  return Array.isArray(cards) && cards.length > 0;
}

async function attachLiveCredits<T extends Record<string, unknown>>(
  payload: T,
  userEmail: string | undefined,
  freePreview: boolean,
): Promise<T & { creditsRemaining: number | null }> {
  if (freePreview || !userEmail) return { ...payload, creditsRemaining: null };
  try {
    const check = await checkCredits(userEmail, 'optimize');
    return { ...payload, creditsRemaining: check.available };
  } catch {
    return { ...payload, creditsRemaining: null };
  }
}

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }
  const freePreview = rawBody.freePreview === true;

  // Extract auth token from header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  let user: any = null;
  let userEmail: string | undefined;

  if (!freePreview && !authHeader) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Authentication required. Please sign in."
      })
    };
  }

  if (authHeader) {
    // Verify token and get authenticated user
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabase = getSupabaseClient();

    if (!supabase) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Server configuration error. Please contact support."
        })
      };
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Invalid or expired authentication token"
        })
      };
    }
    user = authUser;
    userEmail = authUser.email;
  }

  // Extract IP and email verification for anti-abuse checks
  const ipAddress = getClientIP(event);
  const emailVerified = isEmailVerified(user);

  try {
    // Validate request using Zod schema
    const parseResult = OptimizeRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: formatZodError(parseResult.error) })
      };
    }

    const { resumeText, jobText, workHistory, language, userClarifications, userHardStops } = parseResult.data;

    // Detect career vulnerabilities from structured work history
    const vulnerabilities = workHistory?.length
      ? detectVulnerabilities(workHistory)
      : [];

    if (vulnerabilities.length > 0) {
      console.log(`[optimize] Detected ${vulnerabilities.length} career vulnerabilities:`, vulnerabilities.map(v => v.type));
    }

    // -----------------------------------------------------------------------
    // P0 FIX: Redis cache check — bypass Gemini on identical payloads
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
    if (hasRenderableCards(cachedResponse)) {
      console.log('[optimize] Cache HIT — returning cached result, skipping Gemini call.');
      const responsePayload = await attachLiveCredits(cachedResponse, userEmail, freePreview);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        body: JSON.stringify(responsePayload),
      };
    }
    if (cachedResponse) {
      console.warn('[optimize] Cache HIT had no renderable cards — regenerating.');
    }
    console.log('[optimize] Cache MISS — calling Gemini.');
    // -----------------------------------------------------------------------

    if (freePreview) {
      const previewLimit = await checkFreePreviewRateLimit(event, "optimize-free-preview", user?.id || userEmail);
      if (!previewLimit.allowed && previewLimit.response) {
        return previewLimit.response;
      }
    }

    // Check credits after cache lookup so already-paid retries can return.
    const creditCheck = freePreview || !userEmail
      ? { hasCredits: true, required: 0, available: 0 }
      : await checkCredits(userEmail, 'optimize', { ipAddress, emailVerified });

    if (!creditCheck.hasCredits) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Insufficient credits",
          creditsRequired: creditCheck.required,
          creditsAvailable: creditCheck.available,
          creditsNeeded: creditCheck.required - creditCheck.available
        })
      };
    }

    // Add timeout logging
    const startTime = Date.now();

    // Use dedicated optimizeResume function for faster, focused optimization
    const optimization = await optimizeResume(
      resumeText,
      jobText,
      language,
      vulnerabilities,
      userClarifications,
      userHardStops,
      {
        userRef: user?.id || null,
        jdFingerprint: createHash('sha256').update(jobText).digest('hex').slice(0, 16),
      },
    );

    console.log(`[optimize] Gemini call took ${Date.now() - startTime}ms`);
    console.log('[optimize] AI response summary:', {
      hasGapAnalysis: !!optimization?.gap_analysis,
      gapAnalysisCount: optimization?.gap_analysis?.length || 0,
      hasCategoryScores: !!optimization?.category_scores,
      matchScore: optimization?.match_score,
      hasProjectImprovements: !!optimization?.project_improvements,
      projectImprovementsCount: optimization?.project_improvements?.length || 0,
      hasCertificationRecs: !!optimization?.certification_recommendations,
      certificationRecsCount: optimization?.certification_recommendations?.length || 0,
    });

    // CRITICAL: Handle cases where AI returns incomplete data
    if (!optimization) {
      console.error('[optimize] CRITICAL: optimization is undefined!');
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "AI optimization failed to generate suggestions. Please try with a shorter resume or job description.",
        })
      };
    }

    // Map to frontend expected format (Cards)
    const cards = buildOptimizationCards(optimization, { logPrefix: '[optimize]' });

    // Log processing summary
    console.log('[optimize] Processing complete:', {
      cardsGenerated: cards.length,
      sections: [...new Set(cards.map(c => c.section))],
    });

    // Use AI-calculated match score, or calculate from category_scores as fallback
    let scores: ReturnType<typeof calculateScores>;
    try {
      scores = calculateScores(optimization, { cards, logPrefix: '[optimize]' });
    } catch (error) {
      if (error instanceof Error && error.message === 'AI optimization failed to calculate match score') {
        console.error('[optimize] AI did not return match_score or category_scores');
      }
      throw error;
    }
    const { beforeScore, estimatedImprovement } = scores;

    const bulletImprovements = optimization?.bullet_improvements || [];
    const addKeywords = optimization?.missing_keywords || [];

    // Extract JD-matched keywords (keywords resume already has that match JD)
    const matchedKeywords = optimization?.keywords_to_keep || [];

    // Extract all keywords the JD is looking for (matched + missing)
    const jdKeywords = [
      ...matchedKeywords,
      ...addKeywords
    ].filter((k: string, i: number, arr: string[]) => arr.indexOf(k) === i); // dedupe

    // Consume credits AFTER successful optimization
    const creditResult = freePreview || !userEmail
      ? { success: true, creditsRemaining: null }
      : await consumeCredits(userEmail, 'optimize');

    if (!freePreview && userEmail && creditResult.success === false) {
      console.warn('[optimize] Credit consumption failed post-generation - balance raced to insufficient');
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Insufficient credits",
          creditsRequired: 5,
          creditsAvailable: creditResult.creditsRemaining ?? 0,
          creditsNeeded: Math.max(0, 5 - (creditResult.creditsRemaining ?? 0))
        })
      };
    }

    const responsePayload = {
      cards: cards,
      keywords: {
        add: addKeywords,
        neutral: optimization?.keywords_to_keep || [],
        remove: optimization?.keywords_to_avoid || []
      },
      // Match scoring for Results Summary
      matchScoring: {
        beforeScore: Math.round(beforeScore),
        estimatedImprovement: Math.round(estimatedImprovement),
        jdKeywords: jdKeywords.slice(0, 20), // Cap at 20 for UI
        matchedKeywords: matchedKeywords.slice(0, 15),
        reasoning: null,
      },
      // Credit information
      creditsRemaining: creditResult.creditsRemaining,
      freePreview,
      // Gap Analysis - from AI response
      gapAnalysis: (optimization?.gap_analysis || []).map((gap: any) => ({
        requirement: gap.requirement || '',
        currentState: gap.current_state || '',
        severity: gap.gap_severity || 'minor',
        recommendation: gap.recommendation || ''
      })),
      // Keyword Strategy - simplified (not returned by optimizeResume)
      keywordStrategy: {
        mirroredPhrases: [],
        structuralChanges: [],
        hiddenMatches: []
      },
      // Category Scores
      categoryScores: optimization?.category_scores || null,
      // Position name suggestion from AI (only shown if is_necessary=true)
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
      // Project improvements from AI
      projectImprovements: (optimization?.project_improvements || []).map((proj: any) => ({
        project_name: proj.project_name || '',
        original: proj.original || '',
        improved: proj.improved || '',
        issue: proj.issue || '',
        rationale: proj.rationale || ''
      })),
      // Certification recommendations from AI (display-only)
      certificationRecommendations: (optimization?.certification_recommendations || []).map((cert: any) => ({
        name: cert.name || '',
        issuer: cert.issuer || '',
        relevance: cert.relevance || ''
      })),
      // Score Breakdown - simplified
      scoreBreakdown: null,
      source: "gemini",
      debug: {
        totalCards: cards.length,
        hasOptimization: !!optimization,
        hadBulletImprovements: bulletImprovements?.length > 0,
        hasJobDescription: Boolean(jobText && jobText.trim().length > 0),
        model: MODELS.flash,
        latencyMs: Date.now() - startTime,
      }
    };

    // -----------------------------------------------------------------------
    // Store result briefly because optimization cards can include resume snippets.
    // We cache AFTER credit consumption so replays are still free for the user
    // but don't re-charge — credits are only charged once per unique payload.
    // -----------------------------------------------------------------------
    const { creditsRemaining: _omittedCreditsRemaining, ...cacheablePayload } = responsePayload;
    void _omittedCreditsRemaining;
    await setCached(cacheKey, cacheablePayload, OPTIMIZE_CACHE_TTL_SECONDS);
    console.log('[optimize] Cache SET for key:', cacheKey.substring(0, 50));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(responsePayload),
    };

  } catch (error) {
    const errorDetails = error as any;
    console.error("Optimization error:", summarizeErrorForLog(error));

    // Don't send timeout errors to Sentry (expected behavior under load)
    if (errorDetails?.name !== 'TimeoutError') {
      // Strip PII before sending to Sentry - only send metadata
      let rawBody: Record<string, unknown> = {};
      try {
        rawBody = event.body ? JSON.parse(event.body) : {};
      } catch {
        rawBody = {};
      }
      captureError(error, {
        function: 'optimize',
        payload: {
          resumeTextLength: typeof rawBody.resumeText === 'string' ? rawBody.resumeText.length : 0,
          jobTextLength: typeof rawBody.jobText === 'string' ? rawBody.jobText.length : 0,
          hasResumeText: Boolean(rawBody.resumeText),
          hasJobText: Boolean(rawBody.jobText),
        },
      });
    }

    // Return 504 for timeout errors, 500 for other errors
    const isTimeout = errorDetails?.name === 'TimeoutError' || errorDetails?.status === 504;

    return {
      statusCode: isTimeout ? 504 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...(isTimeout && {
          'Retry-After': '30',
          'X-Timeout-Location': 'openrouter-api'
        })
      },
      body: JSON.stringify({
        error: isTimeout
          ? 'Optimization timed out. Retrying automatically...'
          : 'Failed to optimize resume',
        retryable: isTimeout
      }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("optimize", baseHandler);
