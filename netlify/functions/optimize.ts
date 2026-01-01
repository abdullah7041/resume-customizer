import { processResume } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { OptimizeRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

const baseHandler = async (event: { httpMethod: string; body: any; }) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
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

    const analysis = await processResume(resumeText, jobText, false);
    const opt = analysis.optimization;

    // Debug logging to diagnose empty results
    console.log('[optimize] Full analysis response:', JSON.stringify({
      hasOptimization: !!opt,
      hasMatchAnalysis: !!analysis.matchAnalysis,
      optimizationKeys: opt ? Object.keys(opt) : [],
      suggested_headline: opt?.suggested_headline,
      original_headline: opt?.original_headline,
      summary_rewrite: opt?.summary_rewrite ? opt.summary_rewrite.substring(0, 100) + '...' : null,
      original_summary: opt?.original_summary ? opt.original_summary.substring(0, 100) + '...' : null,
      bullet_improvements_count: opt?.bullet_point_improvements?.length || 0,
      education_improvements_count: opt?.education_improvements?.length || 0,
      projects_improvements_count: opt?.projects_improvements?.length || 0,
    }, null, 2));

    // Also log meta.ai_suggestions if present
    const aiSuggestions = analysis.meta?.ai_suggestions;
    if (aiSuggestions) {
      console.log('[optimize] meta.ai_suggestions:', JSON.stringify({
        suggested_headline: aiSuggestions.suggested_headline,
        original_headline: aiSuggestions.original_headline,
        summary_rewrite: aiSuggestions.summary_rewrite ?
          aiSuggestions.summary_rewrite.substring(0, 100) + '...' : null,
        original_summary: aiSuggestions.original_summary ?
          aiSuggestions.original_summary.substring(0, 100) + '...' : null,
        bullet_improvements_count: aiSuggestions.bullet_improvements?.length || 0,
      }, null, 2));

      // Log first bullet improvement to see actual structure
      if (aiSuggestions.bullet_improvements?.length > 0) {
        console.log('[optimize] First bullet improvement sample:', JSON.stringify(aiSuggestions.bullet_improvements[0], null, 2));
      }
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

    // Card 1: Headline - try both optimization and meta.ai_suggestions
    const suggestedHeadline = opt?.suggested_headline || aiSuggestions?.suggested_headline;
    const originalHeadline = opt?.original_headline || aiSuggestions?.original_headline || analysis.basics?.label;

    console.log('[optimize] Headline extraction:', { suggestedHeadline, originalHeadline });

    if (hasContent(suggestedHeadline)) {
      cards.push({
        section: "Headline",
        issue: "Headline could be more targeted.",
        suggestion: "Align headline with the job title and key requirements.",
        exampleBefore: getString(originalHeadline, "Current headline not available"),
        exampleAfter: getString(suggestedHeadline, "")
      });
    }

    // Card 2: Summary - try both optimization and meta.ai_suggestions
    const summaryRewrite = opt?.summary_rewrite || aiSuggestions?.summary_rewrite;
    const originalSummary = opt?.original_summary || aiSuggestions?.original_summary || analysis.basics?.summary;

    console.log('[optimize] Summary extraction:', {
      summaryRewrite: summaryRewrite ? summaryRewrite.substring(0, 50) + '...' : null,
      originalSummary: originalSummary ? originalSummary.substring(0, 50) + '...' : null
    });

    if (hasContent(summaryRewrite)) {
      cards.push({
        section: "Summary",
        issue: "Summary could be more action-oriented.",
        suggestion: "Rewrite summary to better align with the job description.",
        exampleBefore: getString(originalSummary, "Original summary not available"),
        exampleAfter: getString(summaryRewrite, "")
      });
    }

    // Cards for bullets (Experience) - try both locations
    // Note: gemini-client maps to bullet_point_improvements, but ai_suggestions has bullet_improvements
    const bulletImprovements = opt?.bullet_point_improvements ||
      aiSuggestions?.bullet_improvements ||
      [];

    console.log('[optimize] Bullet improvements count:', bulletImprovements.length);

    if (bulletImprovements && bulletImprovements.length > 0) {
      bulletImprovements.forEach((item: { original?: string; improved?: string; suggestion?: string; issue?: string; rationale?: string }, idx: number) => {
        // The AI may return 'improved' or 'suggestion' for the optimized version
        const originalText = item.original;
        const improvedText = item.improved || item.suggestion;

        console.log(`[optimize] Bullet ${idx}:`, {
          originalText: originalText ? originalText.substring(0, 30) + '...' : null,
          improvedText: improvedText ? improvedText.substring(0, 30) + '...' : null
        });

        // Only add card if we have actual content
        if (hasContent(originalText) || hasContent(improvedText)) {
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

    // Cards for Education
    const educationImprovements = opt?.education_improvements || aiSuggestions?.education_improvements || [];

    if (educationImprovements && educationImprovements.length > 0) {
      educationImprovements.forEach((item: { original?: string; improved?: string; suggestion?: string; issue?: string; rationale?: string }) => {
        const originalText = item.original;
        const improvedText = item.improved || item.suggestion;

        if (hasContent(originalText) || hasContent(improvedText)) {
          cards.push({
            section: "Education",
            issue: item.issue || "Education detail could be optimized.",
            suggestion: item.rationale || "Highlight relevant coursework or achievements.",
            exampleBefore: getString(originalText, "Original not provided"),
            exampleAfter: getString(improvedText, "Improvement not provided")
          });
        }
      });
    }

    // Cards for Projects
    const projectsImprovements = opt?.projects_improvements || aiSuggestions?.project_improvements || [];

    if (projectsImprovements && projectsImprovements.length > 0) {
      projectsImprovements.forEach((item: { original?: string; improved?: string; suggestion?: string; issue?: string; rationale?: string }) => {
        const originalText = item.original;
        const improvedText = item.improved || item.suggestion;

        if (hasContent(originalText) || hasContent(improvedText)) {
          cards.push({
            section: "Projects",
            issue: item.issue || "Project description lacks depth.",
            suggestion: item.rationale || "Focus on outcomes and technologies used.",
            exampleBefore: getString(originalText, "Original not provided"),
            exampleAfter: getString(improvedText, "Improvement not provided")
          });
        }
      });
    }

    // Cards for Skills - IMPORTANT: These are SUGGESTIONS, not auto-additions
    const skillsToAdd = opt?.skills_gap_analysis?.missing_keywords_to_add ||
      aiSuggestions?.skills_gap_analysis?.missing_keywords_to_add ||
      [];
    const currentSkills = analysis.skills || [];

    // Flatten current skills for display
    const currentSkillsList = Array.isArray(currentSkills)
      ? currentSkills.flatMap((s: { name?: string; keywords?: string[]; } | string) => typeof s === 'string' ? s : (s.keywords || [s.name])).filter(Boolean).slice(0, 5)
      : [];

    // Only show skills card if there are meaningful suggestions
    if (skillsToAdd.length > 0) {
      cards.push({
        section: "Skills",
        issue: "Consider adding these skills if you have them.",
        suggestion: "If you have experience with these skills, consider adding them to improve ATS matching. Only add skills you actually possess.",
        exampleBefore: currentSkillsList.length > 0
          ? `Current: ${currentSkillsList.join(', ')}`
          : "No skills detected",
        exampleAfter: `Consider: ${skillsToAdd.slice(0, 8).join(', ')}${skillsToAdd.length > 8 ? '...' : ''}`
      });
    }

    // Cards for Certifications
    const certificationImprovements = opt?.certification_improvements || aiSuggestions?.certification_improvements || [];

    if (certificationImprovements && certificationImprovements.length > 0) {
      certificationImprovements.forEach((item: { original?: string; improved?: string; suggestion?: string; issue?: string; rationale?: string }) => {
        const originalText = item.original;
        const improvedText = item.improved || item.suggestion;

        if (hasContent(originalText) || hasContent(improvedText)) {
          cards.push({
            section: "Certifications",
            issue: item.issue || "Certification details could be improved.",
            suggestion: item.rationale || "Highlight relevance to target role.",
            exampleBefore: getString(originalText, "Original not provided"),
            exampleAfter: getString(improvedText, "Improvement not provided")
          });
        }
      });
    }

    // Log final cards with content samples
    console.log('[optimize] Generated cards:', cards.length,
      'Headline:', cards.filter(c => c.section === 'Headline').length,
      'Summary:', cards.filter(c => c.section === 'Summary').length,
      'Experience:', cards.filter(c => c.section === 'Experience').length,
      'Education:', cards.filter(c => c.section === 'Education').length,
      'Projects:', cards.filter(c => c.section === 'Projects').length,
      'Skills:', cards.filter(c => c.section === 'Skills').length,
      'Certifications:', cards.filter(c => c.section === 'Certifications').length
    );

    // Log first card to verify content
    if (cards.length > 0) {
      console.log('[optimize] First card sample:', JSON.stringify(cards[0], null, 2));
    }

    // If still no cards, check if we have missing keywords to at least show something
    if (cards.length === 0) {
      console.warn('[optimize] No cards generated! Full optimization object:', JSON.stringify(opt, null, 2));
    }

    // Log new gap analysis fields
    console.log('[optimize] Gap analysis:', {
      count: (opt?.gap_analysis || aiSuggestions?.gap_analysis || []).length,
      criticalGaps: (opt?.gap_analysis || aiSuggestions?.gap_analysis || [])
        .filter((g: any) => g.gap_severity === 'critical').length,
      firstGap: (opt?.gap_analysis || aiSuggestions?.gap_analysis || [])[0]
    });

    console.log('[optimize] Keyword strategy:', {
      mirroredCount: (opt?.keyword_strategy?.mirrored_phrases || aiSuggestions?.keyword_strategy?.mirrored_phrases || []).length,
      structuralCount: (opt?.keyword_strategy?.structural_changes || aiSuggestions?.keyword_strategy?.structural_changes || []).length,
      hiddenMatchCount: (opt?.keyword_strategy?.hidden_matches || aiSuggestions?.keyword_strategy?.hidden_matches || []).length
    });

    console.log('[optimize] Score breakdown:', opt?.score_breakdown || aiSuggestions?.score_breakdown);

    // Calculate projected score improvement
    const beforeScore = analysis.meta?.match_score || analysis.matchAnalysis?.score_0_to_100 || 55;

    // Score improvement logic:
    // - Base: +3% per optimization card (capped at +20%)
    // - Keywords: +1% per added keyword (capped at +8%)
    // - Max improvement: +25%, Max score: 95%
    const cardBonus = Math.min(cards.length * 3, 20);
    const addKeywords = opt?.skills_gap_analysis?.missing_keywords_to_add ||
      analysis.matchAnalysis?.missingKeywords || [];
    const keywordBonus = Math.min(addKeywords.length * 1, 8);
    const totalImprovement = Math.min(cardBonus + keywordBonus, 25);
    const afterScore = Math.min(beforeScore + totalImprovement, 95);

    // Extract JD-matched keywords (keywords resume already has that match JD)
    const matchedKeywords = opt?.keywords_to_keep ||
      analysis.matchAnalysis?.keywordsToKeep ||
      [];

    // Extract all keywords the JD is looking for (matched + missing)
    const jdKeywords = [
      ...matchedKeywords,
      ...addKeywords
    ].filter((k: string, i: number, arr: string[]) => arr.indexOf(k) === i); // dedupe

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: cards,
        keywords: {
          add: addKeywords,
          neutral: opt?.keywords_to_keep || [],
          remove: opt?.skills_gap_analysis?.irrelevant_skills_to_remove || opt?.keywords_to_avoid || []
        },
        // NEW: Match scoring for Results Summary
        matchScoring: {
          beforeScore: Math.round(beforeScore),
          afterScore: Math.round(afterScore),
          improvement: Math.round(totalImprovement),
          jdKeywords: jdKeywords.slice(0, 20), // Cap at 20 for UI
          matchedKeywords: matchedKeywords.slice(0, 15),
          reasoning: analysis.matchAnalysis?.reasoning || analysis.meta?.ai_suggestions?.reasoning || null,
        },
        // Gap Analysis - NEW
        gapAnalysis: (opt?.gap_analysis || aiSuggestions?.gap_analysis || []).map((gap: any) => ({
          requirement: gap.requirement || '',
          currentState: gap.current_state || '',
          severity: gap.gap_severity || 'minor',
          recommendation: gap.recommendation || ''
        })),
        // Keyword Strategy - NEW
        keywordStrategy: {
          mirroredPhrases: opt?.keyword_strategy?.mirrored_phrases ||
            aiSuggestions?.keyword_strategy?.mirrored_phrases || [],
          structuralChanges: opt?.keyword_strategy?.structural_changes ||
            aiSuggestions?.keyword_strategy?.structural_changes || [],
          hiddenMatches: (opt?.keyword_strategy?.hidden_matches ||
            aiSuggestions?.keyword_strategy?.hidden_matches || []).map((match: any) => ({
              resumeTerm: match.resume_term || '',
              jdRequirement: match.jd_requirement || '',
              insight: match.insight || ''
            }))
        },
        // Score Breakdown - NEW
        scoreBreakdown: opt?.score_breakdown || aiSuggestions?.score_breakdown || null,
        source: "gemini",
        debug: {
          totalCards: cards.length,
          hasOptimization: !!opt,
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
