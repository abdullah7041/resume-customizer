/**
 * Feature flags — dev-only control panel types.
 *
 * Scope: dev control panel only, no remote config, no Supabase table, no A/B testing.
 * All flags default to `true` so shipping this system causes ZERO behavior change.
 * See `src/lib/featureFlags/registry.ts` for the flag definitions.
 */

/** Every flaggable feature (excludes core upload/parse — always on). */
export type FeatureFlagName =
  | "truthCheck"
  | "aiMatch"
  | "optimize"
  | "templatesExport"
  | "interview"
  | "bulkAnalysis"
  | "coverLetter"
  | "vision2030"
  | "pipeline"
  | "onboardingChat"
  | "referral"
  | "feedback"
  | "hrSuperSaudOverlay"
  | "saudiNationalityToggle";

/** Maturity badge shown in the dev dashboard — informational only, does not affect resolution. */
export type FlagMaturity = "stable" | "beta" | "experimental";

/** Static metadata describing one feature flag. */
export interface FeatureFlagDefinition {
  name: FeatureFlagName;
  label: string;
  description: string;
  maturity: FlagMaturity;
  defaultEnabled: boolean;
  /** Vitest file paths (relative to `src/__tests__/` unless otherwise noted) that cover this flag. */
  testFiles: string[];
}

/** Result of running one mapped test file, as recorded by `scripts/flags-test-report.mts`. */
export interface FlagTestFileResult {
  file: string;
  status: "pass" | "fail";
  total: number;
  failed: number;
}

/** Full report written to `src/lib/featureFlags/report/flag-test-report.json`. */
export interface FlagTestReport {
  generatedAt: string;
  results: Record<FeatureFlagName, FlagTestFileResult[]>;
}
