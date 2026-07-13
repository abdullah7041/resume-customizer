// src/lib/utils/deriveAtsExplainability.ts
// Pure, side-effect-free derivation of the four-bucket explainability model
// from existing match/optimize response data. No AI call, no scoring, no
// fetch. INVARIANT: this function may filter and dedupe input strings, but
// must never emit a string that does not already appear in an input field.

import type {
  AtsExplainability,
  AtsExplainabilitySource,
  ExplainabilityCategory,
  ExplainabilityKeyword,
} from '../../types/explainability';
import type { CategoryScore, CategoryScoresData } from '../../components/ScoreBreakdown';

const CATEGORY_KEYS: ExplainabilityCategory[] = [
  'hard_skills',
  'experience',
  'education',
  'soft_skills',
];

/** Collect the `matched` arrays across all categories, tagged by category. */
function categoryMatched(
  categoryScores: CategoryScoresData | null | undefined
): ExplainabilityKeyword[] {
  if (!categoryScores) return [];
  const out: ExplainabilityKeyword[] = [];
  for (const key of CATEGORY_KEYS) {
    const cat: CategoryScore | undefined = categoryScores[key];
    for (const term of cat?.matched ?? []) {
      out.push({ term, category: key });
    }
  }
  return out;
}

/** Collect `missing` + `gaps` arrays across all categories, tagged by category. */
function categoryMissing(
  categoryScores: CategoryScoresData | null | undefined
): ExplainabilityKeyword[] {
  if (!categoryScores) return [];
  const out: ExplainabilityKeyword[] = [];
  for (const key of CATEGORY_KEYS) {
    const cat: CategoryScore | undefined = categoryScores[key];
    for (const term of [...(cat?.missing ?? []), ...(cat?.gaps ?? [])]) {
      out.push({ term, category: key });
    }
  }
  return out;
}

/**
 * Case-insensitive dedupe. Keeps the FIRST occurrence (preserving its casing
 * and category tag). Optionally drops any term present in `exclude`.
 */
function dedupeKeywords(
  keywords: ExplainabilityKeyword[],
  exclude?: Set<string>
): ExplainabilityKeyword[] {
  const seen = new Set<string>();
  const out: ExplainabilityKeyword[] = [];
  for (const kw of keywords) {
    const term = kw.term?.trim();
    if (!term) continue;
    const norm = term.toLowerCase();
    if (seen.has(norm)) continue;
    if (exclude?.has(norm)) continue;
    seen.add(norm);
    out.push({ term, category: kw.category });
  }
  return out;
}

/**
 * Derive the explainability model. All bucket contents come verbatim from the
 * source; the only transformations are filtering, deduping and category tagging.
 */
export function deriveAtsExplainability(
  source: AtsExplainabilitySource
): AtsExplainability {
  const rc = source.realityCheck ?? null;

  const matchedKeywords = dedupeKeywords([
    ...(source.matchedKeywords ?? []).map((term) => ({ term })),
    ...categoryMatched(source.categoryScores),
  ]);

  const matchedNorm = new Set(matchedKeywords.map((k) => k.term.toLowerCase()));

  const missingKeywords = dedupeKeywords(
    [
      ...(source.missingKeywords ?? []).map((term) => ({ term })),
      ...categoryMissing(source.categoryScores),
    ],
    matchedNorm
  );

  const strengths = rc?.strengths ?? [];
  const unclear = rc?.unclearRisks ?? [];
  const risks = rc?.confirmedRisks ?? [];
  const assumptions = rc?.limits?.assumptions ?? [];
  const cannotDetermine = rc?.limits?.cannotDetermine ?? [];
  const gaps = source.gapAnalysis ?? [];
  const hiddenMatches = source.hiddenMatches ?? [];

  const isEmpty =
    matchedKeywords.length === 0 &&
    missingKeywords.length === 0 &&
    strengths.length === 0 &&
    unclear.length === 0 &&
    risks.length === 0 &&
    assumptions.length === 0 &&
    cannotDetermine.length === 0 &&
    gaps.length === 0 &&
    hiddenMatches.length === 0;

  return {
    matched: { keywords: matchedKeywords, strengths },
    missing: { keywords: missingKeywords, gaps },
    weakEvidence: { unclear, hiddenMatches },
    caution: { risks, assumptions, cannotDetermine },
    isEmpty,
  };
}
