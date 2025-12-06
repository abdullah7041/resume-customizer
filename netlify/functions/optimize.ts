import { processResume } from "../lib/gemini-client";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { resumeText, jobText } = body;

    if (!resumeText || !jobText) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing resumeText or jobText" }) };
    }

    const analysis = await processResume(resumeText, jobText, false);
    const opt = analysis.optimization;

    // Map to frontend expected format (Cards)
    const cards = [];

    // Card 1: Headline
    if (opt.suggested_headline) {
      cards.push({
        section: "Headline",
        issue: "Headline could be more targeted.",
        suggestion: "Align headline with the job title and key requirements.",
        exampleBefore: opt.original_headline || "Current Headline (see resume)",
        exampleAfter: opt.suggested_headline
      });
    }

    // Card 2: Summary
    if (opt.summary_rewrite) {
      cards.push({
        section: "Summary",
        issue: "Summary could be more action-oriented.",
        suggestion: "Rewrite summary to better align with the job description.",
        exampleBefore: opt.original_summary || "Original Summary (see resume)",
        exampleAfter: opt.summary_rewrite
      });
    }

    // Cards for bullets (Experience)
    if (opt.bullet_point_improvements) {
      opt.bullet_point_improvements.forEach((item) => {
        cards.push({
          section: "Experience",
          issue: item.issue || "Bullet point lacks impact.",
          suggestion: item.rationale || "Use stronger action verbs and metrics.",
          exampleBefore: item.original,
          exampleAfter: item.improved
        });
      });
    }

    // Cards for Education
    if (opt.education_improvements) {
      opt.education_improvements.forEach((item) => {
        cards.push({
          section: "Education",
          issue: item.issue || "Education detail could be optimized.",
          suggestion: item.rationale || "Highlight relevant coursework or achievements.",
          exampleBefore: item.original,
          exampleAfter: item.improved
        });
      });
    }

    // Cards for Projects
    if (opt.projects_improvements) {
      opt.projects_improvements.forEach((item) => {
        cards.push({
          section: "Projects",
          issue: item.issue || "Project description lacks depth.",
          suggestion: item.rationale || "Focus on outcomes and technologies used.",
          exampleBefore: item.original,
          exampleAfter: item.improved
        });
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: cards,
        keywords: {
          add: opt.skills_gap_analysis?.missing_keywords_to_add || analysis.matchAnalysis.missingKeywords || [],
          neutral: opt.keywords_to_keep || [],
          remove: opt.skills_gap_analysis?.irrelevant_skills_to_remove || opt.keywords_to_avoid || []
        },
        source: "gemini"
      }),
    };

  } catch (error) {
    console.error("Optimization error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to optimize resume" }),
    };
  }
};