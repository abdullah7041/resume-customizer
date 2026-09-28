import {
  normalizeEstimatedImprovement,
  normalizeScore,
  scoreFromCategoryScores,
} from './score-utils.js';
import { validateEditEvidence } from './optimization-evidence.js';
import type { EditEvidence, EvidenceReference, EvidenceSource } from '../../src/types/optimization-evidence.js';

export interface OptimizationCard {
  section: string;
  issue: string;
  suggestion: string;
  exampleBefore: string;
  exampleAfter: string;
  evidence?: EditEvidence;
}

export function hasCurrentEvidenceCards(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const result = value as { evidenceVersion?: unknown; evidenceSources?: unknown; cards?: unknown };
  const sources = result.evidenceSources;
  return result.evidenceVersion === 2 && Array.isArray(sources)
    && sources.length > 0 && Array.isArray(result.cards) && result.cards.length > 0
    && result.cards.every((card: unknown) => {
      if (!card || typeof card !== 'object') return false;
      const evidence = (card as OptimizationCard).evidence;
      return evidence?.version === 1 && (evidence.status === 'source_matched' || evidence.status === 'needs_review')
        && Array.isArray(evidence.references) && evidence.references.length > 0
        && evidence.references.every(reference => sources.some((source: unknown) =>
          source && typeof source === 'object' && (source as EvidenceSource).id === reference.sourceId));
    });
}

interface BulletImprovement {
  original?: string;
  improved?: string;
  suggestion?: string;
  issue?: string;
  rationale?: string;
  target_id?: string;
  evidence_references?: EvidenceReference[];
}

type OptimizationInput = {
  suggested_headline?: unknown;
  original_headline?: unknown;
  headline_target_id?: string;
  headline_evidence_references?: EvidenceReference[];
  summary_rewrite?: unknown;
  original_summary?: unknown;
  summary_target_id?: string;
  summary_evidence_references?: EvidenceReference[];
  bullet_improvements?: BulletImprovement[];
  missing_keywords?: unknown[];
  match_score?: unknown;
  category_scores?: unknown;
  after_score?: unknown;
} | null | undefined;

interface CardBuilderOptions {
  logPrefix: string;
}

interface CalculateScoresOptions extends CardBuilderOptions {
  cards: readonly OptimizationCard[];
}

function hasContent(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function getString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback;
}

export function buildOptimizationCards(
  optimization: OptimizationInput,
  { logPrefix }: CardBuilderOptions,
): OptimizationCard[] {
  const cards: OptimizationCard[] = [];

  // Headline
  const suggestedHeadline = optimization?.suggested_headline || null;
  const originalHeadline = optimization?.original_headline || null;
  if (hasContent(suggestedHeadline) && hasContent(originalHeadline)) {
    cards.push({
      section: 'Headline',
      issue: 'Headline could be more targeted.',
      suggestion: 'Align headline with the job title and key requirements.',
      exampleBefore: getString(originalHeadline, 'Current headline not available'),
      exampleAfter: getString(suggestedHeadline, ''),
    });
  }

  // Summary
  const summaryRewrite = optimization?.summary_rewrite || null;
  const originalSummary = optimization?.original_summary || null;
  if (hasContent(summaryRewrite) && hasContent(originalSummary)) {
    cards.push({
      section: 'Summary',
      issue: 'Summary could be more action-oriented.',
      suggestion: 'Rewrite summary to better align with the job description.',
      exampleBefore: getString(originalSummary, 'Original summary not available'),
      exampleAfter: getString(summaryRewrite, ''),
    });
  }

  // Experience bullets
  // Optional `source_span` (verbatim grounding phrase) rides along on each
  // bullet_improvement; the card type omits it, so it is safely ignored here and
  // remains available on the raw optimization object for a future hover-proof UX.
  const bulletImprovements = optimization?.bullet_improvements || [];
  if (bulletImprovements.length > 0) {
    bulletImprovements.forEach((item) => {
      const originalText = item.original;
      const improvedText = item.improved || item.suggestion;

      const isNAResponse =
        typeof improvedText === 'string' &&
        (improvedText.trim().toLowerCase().startsWith('n/a') ||
          improvedText.toLowerCase().includes('not relevant to the target role') ||
          improvedText.toLowerCase().includes('not relevant to this role'));

      if (hasContent(originalText) && hasContent(improvedText) && !isNAResponse) {
        cards.push({
          section: 'Experience',
          issue: item.issue || 'Bullet point lacks impact.',
          suggestion: item.rationale || 'Use stronger action verbs and metrics.',
          exampleBefore: getString(originalText, 'Original not provided'),
          exampleAfter: getString(improvedText, 'Improvement not provided'),
        });
      }
    });
  }

  // Skills
  const skillsToAdd = optimization?.missing_keywords || [];
  if (skillsToAdd.length > 0) {
    cards.push({
      section: 'Skills',
      issue: 'Consider adding these skills if you have them.',
      suggestion:
        'If you have experience with these skills, consider adding them to improve ATS matching. Only add skills you actually possess.',
      exampleBefore: 'Current resume skills',
      exampleAfter: `Consider: ${skillsToAdd.slice(0, 8).join(', ')}${skillsToAdd.length > 8 ? '...' : ''}`,
    });
  }

  // Fallback
  if (cards.length === 0) {
    console.warn(`${logPrefix} No cards generated, adding fallback guidance`);
    const missingKeywords = optimization?.missing_keywords || [];
    if (missingKeywords.length > 0) {
      cards.push({
        section: 'Skills',
        issue: 'Missing keywords detected',
        suggestion: 'Add these skills if you have them: ' + missingKeywords.slice(0, 5).join(', '),
        exampleBefore: 'Current resume skills',
        exampleAfter: 'Add relevant skills from job description',
      });
    } else {
      cards.push({
        section: 'General',
        issue: 'AI optimization incomplete',
        suggestion:
          "The AI couldn't generate specific improvements. Try with a clearer job description or check resume formatting.",
        exampleBefore: 'Your current resume',
        exampleAfter: 'Consider manual review or retry',
      });
    }
  }

  return cards;
}

export interface EvidenceDiagnostic {
  status: 422;
  code: 'EVIDENCE_INVALID';
  message: string;
}

/** Build only source-bound edit cards from a fresh provider result. */
export async function buildEvidenceBackedOptimizationCards(
  optimization: OptimizationInput,
  { logPrefix, sources }: CardBuilderOptions & { sources: EvidenceSource[] },
): Promise<{ cards: OptimizationCard[]; diagnostics: EvidenceDiagnostic[] }> {
  const cards: OptimizationCard[] = [];
  const diagnostics: EvidenceDiagnostic[] = [];
  const add = async (targetId: string | undefined, original: unknown, proposed: unknown, references: EvidenceReference[] | undefined, input: OptimizationInput) => {
    if (!hasContent(original) || !hasContent(proposed)) return;
    if (!targetId || !references) {
      diagnostics.push({ status: 422, code: 'EVIDENCE_INVALID', message: 'An optimization item lacked valid source evidence.' });
      return;
    }
    const evidence = await validateEditEvidence({ targetId, original: String(original), proposed: String(proposed), references }, sources);
    if (evidence.status === 'rejected' || evidence.reasons.includes('new_number')) {
      diagnostics.push({ status: 422, code: 'EVIDENCE_INVALID', message: 'An optimization item lacked valid source evidence.' });
      return;
    }
    const built = buildOptimizationCards(input, { logPrefix });
    for (const card of built) {
      if (card.section !== 'General' && card.section !== 'Skills') cards.push({ ...card, evidence });
    }
  };
  await add(optimization?.headline_target_id, optimization?.original_headline, optimization?.suggested_headline, optimization?.headline_evidence_references, {
    original_headline: optimization?.original_headline, suggested_headline: optimization?.suggested_headline,
  });
  await add(optimization?.summary_target_id, optimization?.original_summary, optimization?.summary_rewrite, optimization?.summary_evidence_references, {
    original_summary: optimization?.original_summary, summary_rewrite: optimization?.summary_rewrite,
  });
  for (const item of optimization?.bullet_improvements ?? []) {
    await add(item.target_id, item.original, item.improved ?? item.suggestion, item.evidence_references, { bullet_improvements: [item] });
  }
  return { cards, diagnostics };
}

export function calculateScores(
  optimization: OptimizationInput,
  { logPrefix }: CalculateScoresOptions,
): { beforeScore: number; estimatedImprovement: number | null } {
  let beforeScore: number | null = null;
  if (optimization?.match_score != null) {
    beforeScore = normalizeScore(optimization.match_score, 'match_score');
  }

  if (beforeScore === null && optimization?.category_scores) {
    beforeScore = scoreFromCategoryScores(optimization.category_scores);
    console.log(`${logPrefix} Calculated match_score from category_scores:`, beforeScore);
  }

  if (beforeScore === null) {
    throw new Error('AI optimization failed to calculate match score');
  }

  // Card count is not evidence of a score increase. Missing projected scores
  // stay unavailable until the optimized resume is actually re-scored.
  const estimatedImprovement = optimization?.after_score == null
    ? null : normalizeEstimatedImprovement(beforeScore, optimization.after_score);

  return { beforeScore, estimatedImprovement };
}
