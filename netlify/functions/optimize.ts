import { optimizeResume } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { OptimizeRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";
import { checkCredits, consumeCredits } from "../lib/credit-manager";
import { createClient } from "@supabase/supabase-js";

initSentry();

const baseHandler = async (event: { httpMethod: string; body: any; headers: any }) => {
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
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
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

  const userId = user.id;

  // Check credits BEFORE processing (5 credits for optimize)
  const creditCheck = await checkCredits(userId, 'optimize');

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

    const { resumeText, jobText } = parseResult.data;

    // Add timeout logging
    const startTime = Date.now();

    // Use dedicated optimizeResume function for faster, focused optimization
    const optimization = await optimizeResume(resumeText, jobText);

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

        // Only add card if we have BOTH original and improved
        if (hasContent(originalText) && hasContent(improvedText)) {
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
    let beforeScore = optimization?.match_score;

    // Fallback: Calculate from category_scores if match_score is missing
    if (typeof beforeScore !== 'number' && optimization?.category_scores) {
      const cs = optimization.category_scores;
      beforeScore = (cs.hard_skills?.score || 0) +
        (cs.experience?.score || 0) +
        (cs.education?.score || 0) +
        (cs.soft_skills?.score || 0);
      console.log('[optimize] Calculated match_score from category_scores:', beforeScore);
    }

    if (typeof beforeScore !== 'number') {
      console.error('[optimize] AI did not return match_score or category_scores');
      throw new Error('AI optimization failed to calculate match score');
    }

    // Score improvement logic:
    // - Base: +3% per optimization card (capped at +20%)
    // - Keywords: +1% per added keyword (capped at +8%)
    // - Max improvement: +25%, Max score: 95%
    const cardBonus = Math.min(cards.length * 3, 20);
    const addKeywords = optimization?.missing_keywords || [];
    const keywordBonus = Math.min(addKeywords.length * 1, 8);
    const totalImprovement = Math.min(cardBonus + keywordBonus, 25);
    const afterScore = Math.min(beforeScore + totalImprovement, 95);

    // Extract JD-matched keywords (keywords resume already has that match JD)
    const matchedKeywords = optimization?.keywords_to_keep || [];

    // Extract all keywords the JD is looking for (matched + missing)
    const jdKeywords = [
      ...matchedKeywords,
      ...addKeywords
    ].filter((k: string, i: number, arr: string[]) => arr.indexOf(k) === i); // dedupe

    // Consume credits AFTER successful optimization
    await consumeCredits(userId, 'optimize');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: cards,
        keywords: {
          add: addKeywords,
          neutral: optimization?.keywords_to_keep || [],
          remove: optimization?.keywords_to_avoid || []
        },
        // Match scoring for Results Summary
        matchScoring: {
          beforeScore: Math.round(beforeScore),
          afterScore: Math.round(afterScore),
          improvement: Math.round(totalImprovement),
          jdKeywords: jdKeywords.slice(0, 20), // Cap at 20 for UI
          matchedKeywords: matchedKeywords.slice(0, 15),
          reasoning: null,
        },
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
        // Category Scores - NEW
        categoryScores: optimization?.category_scores || null,
        // Project improvements from AI
        projectImprovements: (optimization?.project_improvements || []).map((proj: any) => ({
          project_name: proj.project_name || '',
          original: proj.original || '',
          improved: proj.improved || '',
          issue: proj.issue || '',
          rationale: proj.rationale || ''
        })),
        // Certification recommendations from AI (display-only, not applied to template)
        certificationRecommendations: (optimization?.certification_recommendations || []).map((cert: any) => ({
          name: cert.name || '',
          issuer: cert.issuer || '',
          relevance: cert.relevance || ''
        })),
        // Score Breakdown - simplified (not returned by optimizeResume)
        scoreBreakdown: null,
        source: "gemini",
        debug: {
          totalCards: cards.length,
          hasOptimization: !!optimization,
          hadBulletImprovements: bulletImprovements?.length > 0,
          hasJobDescription: Boolean(jobText && jobText.trim().length > 0),
        }
      }),
    };

  } catch (error) {
    console.error("Optimization error:", error);
    captureError(error, {
      function: 'optimize',
      payload: JSON.parse(event.body || '{}'),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to optimize resume" }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("optimize", baseHandler);
