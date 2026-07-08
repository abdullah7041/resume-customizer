import type { FeatureFlagDefinition, FeatureFlagName } from "@/types/featureFlags";

/**
 * Static feature-flag registry. All `defaultEnabled: true` so shipping this
 * system causes ZERO behavior change — flags are dev-only kill switches for
 * working on one feature at a time, not a rollout mechanism.
 *
 * Test file paths are relative to `src/__tests__/` unless the path already
 * starts with `src/` (verified to exist on disk).
 */
export const FEATURE_FLAGS: Record<FeatureFlagName, FeatureFlagDefinition> = {
  truthCheck: {
    name: "truthCheck",
    label: "Truth Check",
    description: "Resume Truth Check tab — flags unverifiable or inflated claims before you apply.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: ["TruthCheckSection.test.tsx", "truthCheckSummary.test.ts"],
  },
  aiMatch: {
    name: "aiMatch",
    label: "AI Match",
    description: "Match tab — AI-scored comparison between resume and job description.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: ["JobMatch.test.jsx", "matchScore.fixture.test.js", "honest-scoring.test.jsx"],
  },
  optimize: {
    name: "optimize",
    label: "Optimize",
    description: "Optimize tab — AI bullet rewrites with STAR + metric enforcement.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: [
      "OptimizeSection.test.jsx",
      "OptimizationCard.test.jsx",
      "optimize-score-override-bug.test.jsx",
      "score-drift-bug.test.jsx",
    ],
  },
  templatesExport: {
    name: "templatesExport",
    label: "Templates & Export",
    description: "Templates tab — resume templates, PDF/DOCX export.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: [
      "TemplatesSection.test.jsx",
      "template-rtl.test.tsx",
      "template-data-completeness.test.jsx",
      "template-fallback-recovery.test.tsx",
    ],
  },
  interview: {
    name: "interview",
    label: "Interview Prep",
    description: "Interview tab — predicted interview questions based on resume + job description.",
    maturity: "beta",
    defaultEnabled: true,
    testFiles: [],
  },
  bulkAnalysis: {
    name: "bulkAnalysis",
    label: "Bulk Analysis",
    description: "Bulk tab — compare one resume against multiple job descriptions at once.",
    maturity: "beta",
    defaultEnabled: true,
    testFiles: ["bug-bulk-analysis.test.tsx"],
  },
  coverLetter: {
    name: "coverLetter",
    label: "Cover Letter",
    description: "Cover Letter tab — AI-generated cover letters with tone selection.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: ["CoverLetterSection.i18n.test.tsx"],
  },
  vision2030: {
    name: "vision2030",
    label: "Vision 2030",
    description: "Vision 2030 tab — Saudi Vision 2030 alignment analysis (premium).",
    maturity: "beta",
    defaultEnabled: true,
    testFiles: ["src/lib/utils/__tests__/vision2030Analyzer.test.ts"],
  },
  pipeline: {
    name: "pipeline",
    label: "Job Pipeline",
    description: "Pipeline tab — track job applications through their lifecycle.",
    maturity: "beta",
    defaultEnabled: true,
    testFiles: ["PipelineSection.test.jsx", "SaveJobToPipelineCard.test.jsx"],
  },
  onboardingChat: {
    name: "onboardingChat",
    label: "Onboarding Chat",
    description: "First-run conversational onboarding gate shown to new users.",
    maturity: "experimental",
    defaultEnabled: true,
    testFiles: ["App.onboarding.test.tsx"],
  },
  referral: {
    name: "referral",
    label: "Referrals",
    description: "Referral stats and link in the Credit Usage modal.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: [],
  },
  feedback: {
    name: "feedback",
    label: "Feedback",
    description: "Feedback modal and header trigger buttons.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: ["FeedbackModal.test.tsx", "Header.feedback.test.tsx"],
  },
  hrSuperSaudOverlay: {
    name: "hrSuperSaudOverlay",
    label: "HR Super Saud Overlay",
    description: "Floating HR Super Saud mascot/guide overlay.",
    maturity: "experimental",
    defaultEnabled: true,
    testFiles: ["hr-super-saud-context.test.tsx"],
  },
  saudiNationalityToggle: {
    name: "saudiNationalityToggle",
    label: "Saudi Nationality Toggle",
    description: "Upload card toggle that prepends \"Saudi\" to the resume summary.",
    maturity: "stable",
    defaultEnabled: true,
    testFiles: ["src/lib/stores/resumeStore.test.ts"],
  },
};

/**
 * Pure resolver — no store dependency, unit-testable without fighting env.
 * When `applyOverrides` is false the shipped default wins regardless of what
 * `overrides` contains; when true, a set override wins over the default.
 */
export function resolveFlag(
  name: FeatureFlagName,
  overrides: Partial<Record<FeatureFlagName, boolean>>,
  applyOverrides: boolean
): boolean {
  const defaultValue = FEATURE_FLAGS[name].defaultEnabled;
  if (!applyOverrides) return defaultValue;
  const override = overrides[name];
  return override ?? defaultValue;
}
