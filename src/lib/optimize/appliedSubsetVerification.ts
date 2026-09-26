import { analyzeResumeWithAI } from '@/services/api';
import { formatResumeToText } from '@/lib/utils/resumeUtils';
import { mergeOptimizedResume } from '@/lib/optimize/mergeResume';
import { partitionOptimizations } from '@/lib/optimize/actionability';
import type { CachedAnalysis, OptimizationResult } from '@/types/templates';
import type { ResumeSchema } from '@/types/resume';
import type { AssessmentContext } from '@/types/assessment';
import { createAssessmentContext } from '@/lib/match/assessmentContext';

type CachedAssessmentLookup = (context: AssessmentContext) => CachedAnalysis | null;
type CachedAssessmentWriter = (context: AssessmentContext, analysis: Omit<CachedAnalysis, 'timestamp'>) => void;

export type AppliedSubsetVerificationResult =
  | { status: 'idle' }
  | { status: 'outdated' }
  | { status: 'ready'; appliedCount: number }
  | { status: 'unavailable'; reason: 'missing_job_description' | 'missing_resume' }
  | { status: 'failed'; reason: 'too_short' | 'unchanged' | 'invalid_score' | 'request_error' }
  | { status: 'verified'; score: number; appliedCount: number; source: 'cache' | 'network'; freeVerify?: boolean };

export interface AppliedSubsetVerificationInput {
  originalResume: ResumeSchema | null;
  optimizations: OptimizationResult[];
  isSaudiNational: boolean;
  sourceResumeText: string;
  jobDescription: string;
  language: string;
  getCachedAssessment: CachedAssessmentLookup;
  setCachedAssessment: CachedAssessmentWriter;
  isCurrent: () => boolean;
  allowNetwork: boolean;
}

const finiteScore = (value: unknown): number | null => {
  const score = Number(value);
  return Number.isFinite(score) ? Math.round(Math.min(100, Math.max(0, score))) : null;
};

/**
 * Resolves a score for the currently applied cards without mutating store state.
 * Cache checks are safe to run automatically; a network verification is allowed
 * only after the caller has obtained an explicit credit confirmation.
 */
export async function resolveAppliedSubsetVerification(
  input: AppliedSubsetVerificationInput,
): Promise<AppliedSubsetVerificationResult> {
  if (!input.jobDescription.trim()) return { status: 'unavailable', reason: 'missing_job_description' };
  if (!input.originalResume) return { status: 'unavailable', reason: 'missing_resume' };

  const { actionable } = partitionOptimizations(input.optimizations);
  const appliedCount = actionable.filter((optimization) => optimization.applied && optimization.mergeStatus !== 'failed').length;
  if (appliedCount === 0) return { status: 'idle' };

  const { resume: appliedResume } = mergeOptimizedResume(
    input.originalResume,
    input.optimizations,
    { isSaudiNational: input.isSaudiNational },
  );
  const { resume: baselineResume } = mergeOptimizedResume(
    input.originalResume,
    [],
    { isSaudiNational: input.isSaudiNational },
  );
  const appliedText = formatResumeToText(appliedResume);
  const baselineText = formatResumeToText(baselineResume);
  const sourceTextLength = (input.sourceResumeText || JSON.stringify(input.originalResume)).length;

  if (appliedText.length < Math.max(200, sourceTextLength * 0.5)) {
    console.warn(`[AppliedSubsetVerification] merged text too short (${appliedText.length} chars)`);
    return { status: 'failed', reason: 'too_short' };
  }
  if (appliedText.replace(/\s+/g, ' ').trim() === baselineText.replace(/\s+/g, ' ').trim()) {
    console.warn('[AppliedSubsetVerification] merged text is identical to the baseline');
    return { status: 'failed', reason: 'unchanged' };
  }

  const context = await createAssessmentContext({ resumeText: appliedText,
    jobDescription: input.jobDescription, language: input.language === 'ar' ? 'ar' : 'en',
    kind: 'match', isOptimized: true, rubricVersion: 'match-v1' });
  if (!input.isCurrent()) return { status: 'outdated' };
  const cachedScore = finiteScore(input.getCachedAssessment(context)?.score);
  if (cachedScore !== null) return { status: 'verified', score: cachedScore, appliedCount, source: 'cache' };
  if (!input.allowNetwork) return { status: 'ready', appliedCount };

  try {
    const result = await analyzeResumeWithAI(appliedText, input.jobDescription, input.language, { mode: 'verify', verifyKind: 'applied_subset' });
    if (!input.isCurrent()) return { status: 'outdated' };
    const score = finiteScore(result?.score);
    if (score === null) return { status: 'failed', reason: 'invalid_score' };

    input.setCachedAssessment(context, {
      score,
      matchedKeywords: result.topHits || [],
      missingKeywords: result.missingKeywords || [],
    });
    return { status: 'verified', score, appliedCount, source: 'network', freeVerify: result.freeVerify === true };
  } catch {
    if (!input.isCurrent()) return { status: 'outdated' };
    console.warn('[AppliedSubsetVerification] request failed (non-fatal)');
    return { status: 'failed', reason: 'request_error' };
  }
}
