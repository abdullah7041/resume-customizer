// src/types/explainability.ts
// Types for the ATS Explainability Panel. Everything here is DERIVED from
// existing match/optimize response data — no new AI call, no new scoring.
// The derivation (src/lib/utils/deriveAtsExplainability.ts) may filter and
// dedupe input, but must never synthesize a string that is not present in an
// input field.

import type { CategoryScoresData } from '../components/ScoreBreakdown';
import type {
  GapAnalysisItem,
  HiddenMatch,
  StrategicRealityCheck,
  RealityCheckStrength,
  ConfirmedRisk,
  UnclearRisk,
} from './analysis';

/** Category keys used to tag where a matched/missing keyword came from. */
export type ExplainabilityCategory =
  | 'hard_skills'
  | 'experience'
  | 'education'
  | 'soft_skills';

/**
 * Raw inputs to the derivation. Every field is optional; all values are
 * verbatim from existing responses (match analysis or cached analysis +
 * optimization metrics). Nothing is fetched or generated to build this.
 */
export interface AtsExplainabilitySource {
  /** strongMatches | matchedKeywords | topHits (already server-produced). */
  matchedKeywords?: string[];
  missingKeywords?: string[];
  categoryScores?: CategoryScoresData | null;
  realityCheck?: StrategicRealityCheck | null;
  /** Optimize context only — match side returns []. */
  gapAnalysis?: GapAnalysisItem[];
  /** Passthrough only; currently always empty from live endpoints. */
  hiddenMatches?: HiddenMatch[];
}

/** A keyword plus an optional tag for the category it was matched under. */
export interface ExplainabilityKeyword {
  term: string;
  category?: ExplainabilityCategory;
}

/**
 * The four-bucket explainability model rendered by AtsExplainabilityPanel.
 * `isEmpty` is true when no bucket has any content (panel renders null).
 */
export interface AtsExplainability {
  matched: {
    keywords: ExplainabilityKeyword[];
    strengths: RealityCheckStrength[];
  };
  missing: {
    keywords: ExplainabilityKeyword[];
    gaps: GapAnalysisItem[];
  };
  weakEvidence: {
    unclear: UnclearRisk[];
    hiddenMatches: HiddenMatch[];
  };
  caution: {
    risks: ConfirmedRisk[];
    assumptions: string[];
    cannotDetermine: string[];
  };
  isEmpty: boolean;
}
