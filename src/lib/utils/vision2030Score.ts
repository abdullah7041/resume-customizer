import type { Vision2030AnalysisResponse } from '@/types/vision2030';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasTextField = (value: unknown, field: string): boolean =>
  isRecord(value) && typeof value[field] === 'string' && value[field].trim().length > 0;

/**
 * A Vision 2030 result must provide more than aggregate scores: users need
 * either resume-grounded evidence or a concrete improvement recommendation.
 */
export const isUsableVision2030Analysis = (analysis: unknown): analysis is Vision2030AnalysisResponse => {
  if (!isRecord(analysis) || typeof analysis.overallScore !== 'number' || !Number.isFinite(analysis.overallScore)) {
    return false;
  }

  if (!Array.isArray(analysis.sectorBreakdown) || analysis.sectorBreakdown.length === 0) return false;
  if (!analysis.sectorBreakdown.every((sector) => isRecord(sector) && typeof sector.score === 'number' && Number.isFinite(sector.score))) {
    return false;
  }

  const matchedSkills = Array.isArray(analysis.matchedSkills) ? analysis.matchedSkills : [];
  const missingSuggestions = Array.isArray(analysis.missingSuggestions) ? analysis.missingSuggestions : [];
  return matchedSkills.some((skill) => hasTextField(skill, 'context'))
    || missingSuggestions.some((suggestion) => hasTextField(suggestion, 'reason'));
};

export const normalizeVision2030Score = (score: number): number => {
  if (!Number.isFinite(score)) return 0;
  const percentage = score > 0 && score < 1 ? score * 100 : score;
  return Math.min(Math.max(percentage, 0), 100);
};

export const normalizeVision2030Analysis = (
  analysis: Vision2030AnalysisResponse,
): Vision2030AnalysisResponse => ({
  ...analysis,
  overallScore: normalizeVision2030Score(analysis.overallScore),
  sectorBreakdown: analysis.sectorBreakdown.map((sector) => ({
    ...sector,
    score: normalizeVision2030Score(sector.score),
  })),
});

export const getVision2030ScoreTextColor = (score: number): string => {
  if (score >= 70) return 'text-emerald-700 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
};
