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
    if (analysis.meta?.ai_suggestions) {
      console.log('[optimize] meta.ai_suggestions:', JSON.stringify({
        suggested_headline: analysis.meta.ai_suggestions.suggested_headline,
        original_headline: analysis.meta.ai_suggestions.original_headline,
        summary_rewrite: analysis.meta.ai_suggestions.summary_rewrite ?
          analysis.meta.ai_suggestions.summary_rewrite.substring(0, 100) + '...' : null,
        bullet_improvements_count: analysis.meta.ai_suggestions.bullet_improvements?.length || 0,
      }, null, 2));
    }

    // Map to frontend expected format (Cards)
    const cards: Array<{
      section: string;
      issue: string;
      suggestion: string;
      exampleBefore: string;
      exampleAfter: string;
    }> = [];

    // Helper to validate content exists
    const hasContent = (value: any): boolean => {
      if (!value) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return true;
    };

    // Card 1: Headline - try both optimization and meta.ai_suggestions
    const suggestedHeadline = opt?.suggested_headline || analysis.meta?.ai_suggestions?.suggested_headline;
    const originalHeadline = opt?.original_headline || analysis.meta?.ai_suggestions?.original_headline || analysis.basics?.label;

    if (hasContent(suggestedHeadline)) {
      cards.push({
        section: "Headline",
        issue: "Headline could be more targeted.",
        suggestion: "Align headline with the job title and key requirements.",
        exampleBefore: originalHeadline || "Current headline not available",
        exampleAfter: suggestedHeadline
      });
    }

    // Card 2: Summary - try both optimization and meta.ai_suggestions
    const summaryRewrite = opt?.summary_rewrite || analysis.meta?.ai_suggestions?.summary_rewrite;
    const originalSummary = opt?.original_summary || analysis.meta?.ai_suggestions?.original_summary || analysis.basics?.summary;

    if (hasContent(summaryRewrite)) {
      cards.push({
        section: "Summary",
        issue: "Summary could be more action-oriented.",
        suggestion: "Rewrite summary to better align with the job description.",
        exampleBefore: originalSummary || "Original summary not available",
        exampleAfter: summaryRewrite
      });
    }

    // Cards for bullets (Experience) - try both locations
    const bulletImprovements = opt?.bullet_point_improvements ||
      (analysis.meta?.ai_suggestions?.bullet_improvements || []).map((b: any) => ({
        original: b.original,
        improved: b.improved,
        issue: b.issue,
        rationale: b.rationale
      }));

    if (bulletImprovements && bulletImprovements.length > 0) {
      bulletImprovements.forEach((item: any) => {
        // Only add card if we have actual content
        if (hasContent(item.original) || hasContent(item.improved)) {
          cards.push({
            section: "Experience",
            issue: item.issue || "Bullet point lacks impact.",
            suggestion: item.rationale || "Use stronger action verbs and metrics.",
            exampleBefore: item.original || "Original not provided",
            exampleAfter: item.improved || "Improvement not provided"
          });
        }
      });
    }

    // Cards for Education
    const educationImprovements = opt?.education_improvements ||
      (analysis.meta?.ai_suggestions?.education_improvements || []);

    if (educationImprovements && educationImprovements.length > 0) {
      educationImprovements.forEach((item: any) => {
        if (hasContent(item.original) || hasContent(item.improved)) {
          cards.push({
            section: "Education",
            issue: item.issue || "Education detail could be optimized.",
            suggestion: item.rationale || "Highlight relevant coursework or achievements.",
            exampleBefore: item.original || "Original not provided",
            exampleAfter: item.improved || "Improvement not provided"
          });
        }
      });
    }

    // Cards for Projects
    const projectsImprovements = opt?.projects_improvements ||
      (analysis.meta?.ai_suggestions?.project_improvements || []);

    if (projectsImprovements && projectsImprovements.length > 0) {
      projectsImprovements.forEach((item: any) => {
        if (hasContent(item.original) || hasContent(item.improved)) {
          cards.push({
            section: "Projects",
            issue: item.issue || "Project description lacks depth.",
            suggestion: item.rationale || "Focus on outcomes and technologies used.",
            exampleBefore: item.original || "Original not provided",
            exampleAfter: item.improved || "Improvement not provided"
          });
        }
      });
    }

    // Log final cards count
    console.log('[optimize] Generated cards:', cards.length,
      'Headline:', cards.filter(c => c.section === 'Headline').length,
      'Summary:', cards.filter(c => c.section === 'Summary').length,
      'Experience:', cards.filter(c => c.section === 'Experience').length,
      'Education:', cards.filter(c => c.section === 'Education').length,
      'Projects:', cards.filter(c => c.section === 'Projects').length
    );

    // If still no cards, check if we have missing keywords to at least show something
    if (cards.length === 0) {
      console.warn('[optimize] No cards generated! Full optimization object:', JSON.stringify(opt, null, 2));
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: cards,
        keywords: {
          add: opt?.skills_gap_analysis?.missing_keywords_to_add || analysis.matchAnalysis?.missingKeywords || [],
          neutral: opt?.keywords_to_keep || [],
          remove: opt?.skills_gap_analysis?.irrelevant_skills_to_remove || opt?.keywords_to_avoid || []
        },
        source: "gemini",
        debug: {
          totalCards: cards.length,
          hasOptimization: !!opt,
          hadBulletImprovements: bulletImprovements?.length > 0
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
