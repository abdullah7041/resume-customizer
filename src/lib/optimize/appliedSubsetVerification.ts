import { analyzeResumeWithAI } from '@/services/api';
import { formatResumeToText } from '@/lib/utils/resumeUtils';
import { mergeOptimizedResume } from '@/lib/optimize/mergeResume';
import { partitionOptimizations } from '@/lib/optimize/actionability';
import type { CachedAnalysis, OptimizationResult } from '@/types/templates';
import type { ResumeSchema } from '@/types/resume';

type CachedAnalysisLookup = (resumeText: string, jobDescription: string, forceIsOptimized?: boolean) => CachedAnalysis | null;
type CachedAnalysisWriter = (resumeText: string, jobDescription: string, analysis: Omit<CachedAnalysis, 'timestamp'>, forceIsOptimized?: boolean) => void;

export type AppliedSubsetVerificationResult =
  | { status: 'idle' }
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
  getCachedAnalysis: CachedAnalysisLookup;
  setCachedAnalysis: CachedAnalysisWriter;
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

  const cachedScore = finiteScore(input.getCachedAnalysis(appliedText, input.jobDescription, true)?.score);
  if (cachedScore !== null) return { status: 'verified', score: cachedScore, appliedCount, source: 'cache' };
  if (!input.allowNetwork) return { status: 'ready', appliedCount };

  try {
    const result = await analyzeResumeWithAI(appliedText, input.jobDescription, input.language, { mode: 'verify', verifyKind: 'applied_subset' });
    const score = finiteScore(result?.score);
    if (score === null) return { status: 'failed', reason: 'invalid_score' };

    input.setCachedAnalysis(appliedText, input.jobDescription, {
      score,
      matchedKeywords: result.topHits || [],
      missingKeywords: result.missingKeywords || [],
    }, true);
    return { status: 'verified', score, appliedCount, source: 'network', freeVerify: result.freeVerify === true };
  } catch (error) {
    console.warn('[AppliedSubsetVerification] request failed (non-fatal):', error);
    return { status: 'failed', reason: 'request_error' };
  }
}
