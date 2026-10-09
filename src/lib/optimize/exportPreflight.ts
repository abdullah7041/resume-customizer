import { fingerprintText } from '@/lib/match/assessmentContext';
import { isConfirmationCurrent, proposalStatement } from '@/lib/optimize/evidenceReview';
import { mergeOptimizedResume, type MergeOptions } from '@/lib/optimize/mergeResume';
import type { ResumeSchema } from '@/types/resume';
import type { OptimizationResult } from '@/types/templates';

export interface ExportReviewInput {
  documentFingerprint: string;
  includedEdits: OptimizationResult[];
  missingBaseline: boolean;
  legacyDocumentConfirmation?: { documentFingerprint: string; confirmedAt: string };
}

export type ExportReviewResult =
  | { allowed: true; documentFingerprint: string }
  | { allowed: false; documentFingerprint: string; sectionIds: string[]; reason: 'review_required' | 'legacy_review' };

/** Capture the document and included claims before the first async export step. */
export async function createExportSnapshot(
  original: ResumeSchema,
  optimizations: readonly OptimizationResult[],
  options: MergeOptions,
): Promise<{ resume: ResumeSchema; includedEdits: OptimizationResult[]; documentFingerprint: string }> {
  const { resume, includedEdits } = mergeOptimizedResume(original, optimizations, options);
  const claims = structuredClone(includedEdits);
  const documentFingerprint = await fingerprintText(JSON.stringify(resume));
  return { resume, includedEdits: claims, documentFingerprint };
}

export function reviewExport(input: ExportReviewInput): ExportReviewResult {
  const { documentFingerprint } = input;
  if (input.missingBaseline) {
    return input.legacyDocumentConfirmation?.documentFingerprint === documentFingerprint
      && !!input.legacyDocumentConfirmation.confirmedAt
      ? { allowed: true, documentFingerprint }
      : { allowed: false, documentFingerprint, sectionIds: [], reason: 'legacy_review' };
  }

  const sectionIds = [...new Set(input.includedEdits
    .filter(edit => edit.evidence?.status !== 'source_matched'
      && !isConfirmationCurrent(edit.evidence, edit.confirmation, proposalStatement(edit.optimized)))
    .map(edit => edit.sectionId))];
  return sectionIds.length
    ? { allowed: false, documentFingerprint, sectionIds, reason: 'review_required' }
    : { allowed: true, documentFingerprint };
}
