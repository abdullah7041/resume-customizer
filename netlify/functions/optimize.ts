import { Handler } from '@netlify/functions';
import { optimizeResume } from "../lib/gemini-client.js";
import { withRateLimit } from "../lib/rate-limiter.js";
import { OptimizeRequestSchema, formatZodError } from "../lib/resume-schemas.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";
import { checkCredits, consumeCredits } from "../lib/credit-manager.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { getClientIP } from "../lib/ip-utils.js";
import { detectVulnerabilities } from "../lib/vulnerability-detector.js";
import { buildCacheKey, getCached, setCached } from "../lib/redis-cache.js";
import { normalizeEstimatedImprovement, normalizeScore, scoreFromCategoryScores } from "../lib/score-utils.js";
import { MODELS } from "../lib/model-registry.js";

initSentry();

const OPTIMIZE_CACHE_TTL_SECONDS = 600;

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Extract auth token from header
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Authentication required. Please sign in."
      })
    };
  }

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

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Invalid or expired authentication token"
      })
    };
  }

  const userEmail = user.email;

  // Extract IP and email verification for anti-abuse checks
  const ipAddress = getClientIP(event);
  const emailVerified = user.email_confirmed_at !== null || (user as any).email_verified !== false;

  // Check credits BEFORE processing (5 credits for optimize)
  const creditCheck = await checkCredits(userEmail, 'optimize', { ipAddress, emailVerified });

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

  try {
    const rawBody = JSON.parse(event.body || "{}");

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
    const cacheKey = buildCacheKey('optimize', {
      resumeText: resumeText.trim(),
      jobText: jobText.trim(),
      language: language || 'en',
      vulnerabilities: vulnerabilities.map((v: any) => v.type).sort(),
      userClarifications: userClarifications || '',
      userHardStops: userHardStops || [],
    });

    const cachedResponse = await getCached<Record<string, unknown>>(cacheKey);
    if (cachedResponse) {
      console.log('[optimize] Cache HIT — returning cached result, skipping Gemini call.');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        body: JSON.stringify(cachedResponse),
      };
    }
    console.log('[optimize] Cache MISS — calling Gemini.');
    // -----------------------------------------------------------------------

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
    const cards: Array<{
      section: string;
      issue: string;
      suggestion: string;
      exampleBefore: string;
      exampleAfter: string;
    }> = [];

    // Helper to validate content exists and extract string value
    const hasContent = (value: unknown): boolean => {
      if (!value) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return true;
    };

    // Helper to safely get string value
    const getString = (value: unknown, fallback: string): string => {
      if (typeof value === 'string' && value.trim().length > 0) return value;
      return fallback;
    };

    // Safe extraction with explicit fallbacks
    const suggestedHeadline = optimization?.suggested_headline || null;
    const originalHeadline = optimization?.original_headline || null;

    // Only generate card if we have BOTH original and improved
    if (hasContent(suggestedHeadline) && hasContent(originalHeadline)) {
      cards.push({
        section: "Headline",
        issue: "Headline could be more targeted.",
        suggestion: "Align headline with the job title and key requirements.",
        exampleBefore: getString(originalHeadline, "Current headline not available"),
        exampleAfter: getString(suggestedHeadline, "")
      });
    }

    // Card 2: Summary
    const summaryRewrite = optimization?.summary_rewrite || null;
    const originalSummary = optimization?.original_summary || null;

    if (hasContent(summaryRewrite) && hasContent(originalSummary)) {
      cards.push({
        section: "Summary",
        issue: "Summary could be more action-oriented.",
        suggestion: "Rewrite summary to better align with the job description.",
        exampleBefore: getString(originalSummary, "Original summary not available"),
        exampleAfter: getString(summaryRewrite, "")
      });
    }

    // Cards for bullets (Experience)
    const bulletImprovements = optimization?.bullet_improvements || [];

    if (bulletImprovements && bulletImprovements.length > 0) {
      bulletImprovements.forEach((item: { original?: string; improved?: string; suggestion?: string; issue?: string; rationale?: string }) => {
        const originalText = item.original;
        const improvedText = item.improved || item.suggestion;

        // Safety filter: skip any bullet the AI marked as N/A or "not relevant"
        const isNAResponse = typeof improvedText === 'string' && (
          improvedText.trim().toLowerCase().startsWith('n/a') ||
          improvedText.toLowerCase().includes('not relevant to the target role') ||
          improvedText.toLowerCase().includes('not relevant to this role')
        );

        // Only add card if we have BOTH original and improved, and it's not an N/A placeholder
        if (hasContent(originalText) && hasContent(improvedText) && !isNAResponse) {
          cards.push({
            section: "Experience",
            issue: item.issue || "Bullet point lacks impact.",
            suggestion: item.rationale || "Use stronger action verbs and metrics.",
            exampleBefore: getString(originalText, "Original not provided"),
            exampleAfter: getString(improvedText, "Improvement not provided")
          });
        }
      });
    }

    // Cards for Skills - IMPORTANT: These are SUGGESTIONS, not auto-additions
    const skillsToAdd = optimization?.missing_keywords || [];

    if (skillsToAdd.length > 0) {
      cards.push({
        section: "Skills",
        issue: "Consider adding these skills if you have them.",
        suggestion: "If you have experience with these skills, consider adding them to improve ATS matching. Only add skills you actually possess.",
        exampleBefore: "Current resume skills",
        exampleAfter: `Consider: ${skillsToAdd.slice(0, 8).join(', ')}${skillsToAdd.length > 8 ? '...' : ''}`
      });
    }

    // If still no cards after all processing, add fallback
    if (cards.length === 0) {
      console.warn('[optimize] No cards generated, adding fallback guidance');

      // Check if we have raw data to provide some value
      const missingKeywords = optimization?.missing_keywords || [];

      if (missingKeywords.length > 0) {
        cards.push({
          section: "Skills",
          issue: "Missing keywords detected",
          suggestion: "Add these skills if you have them: " + missingKeywords.slice(0, 5).join(', '),
          exampleBefore: "Current resume skills",
          exampleAfter: "Add relevant skills from job description"
        });
      } else {
        cards.push({
          section: "General",
          issue: "AI optimization incomplete",
          suggestion: "The AI couldn't generate specific improvements. Try with a clearer job description or check resume formatting.",
          exampleBefore: "Your current resume",
          exampleAfter: "Consider manual review or retry"
        });
      }
    }

    // Log processing summary
    console.log('[optimize] Processing complete:', {
      cardsGenerated: cards.length,
      sections: [...new Set(cards.map(c => c.section))],
    });

    // Use AI-calculated match score, or calculate from category_scores as fallback
    let beforeScore: number | null = null;
    if (optimization?.match_score != null) {
      beforeScore = normalizeScore(optimization.match_score, 'match_score');
    }

    // Fallback: Calculate from category_scores if match_score is missing
    if (beforeScore === null && optimization?.category_scores) {
      beforeScore = scoreFromCategoryScores(optimization.category_scores);
      console.log('[optimize] Calculated match_score from category_scores:', beforeScore);
    }

    if (beforeScore === null) {
      console.error('[optimize] AI did not return match_score or category_scores');
      throw new Error('AI optimization failed to calculate match score');
    }

    // Estimated improvement is now explicitly calculated by the AI using the ATS-aligned strict rubric
    const addKeywords = optimization?.missing_keywords || [];
    
    // Fallback logic in case after_score is omitted or hallucinated lower than beforeScore
    const fallbackImprovement = Math.min(cards.length * 2, 15);
    const estimatedImprovement = normalizeEstimatedImprovement(beforeScore, optimization?.after_score, fallbackImprovement);

    // Extract JD-matched keywords (keywords resume already has that match JD)
    const matchedKeywords = optimization?.keywords_to_keep || [];

    // Extract all keywords the JD is looking for (matched + missing)
    const jdKeywords = [
      ...matchedKeywords,
      ...addKeywords
    ].filter((k: string, i: number, arr: string[]) => arr.indexOf(k) === i); // dedupe

    // Consume credits AFTER successful optimization
    const creditResult = await consumeCredits(userEmail, 'optimize');

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
    await setCached(cacheKey, responsePayload, OPTIMIZE_CACHE_TTL_SECONDS);
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
