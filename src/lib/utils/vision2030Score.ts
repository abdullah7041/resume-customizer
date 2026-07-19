import type { Vision2030AnalysisResponse } from '@/types/vision2030';

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
