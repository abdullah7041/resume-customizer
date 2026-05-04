export function normalizeScore(value: unknown, label = 'score'): number {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    throw new Error(`AI response missing valid ${label}`);
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

const REQUIRED_CATEGORY_SCORE_KEYS = [
  'hard_skills',
  'experience',
  'education',
  'soft_skills',
] as const;

export function scoreFromCategoryScores(categoryScores: any): number | null {
  if (!categoryScores || typeof categoryScores !== 'object') {
    return null;
  }

  let total = 0;

  for (const key of REQUIRED_CATEGORY_SCORE_KEYS) {
    const category = categoryScores[key];
    if (!category || typeof category !== 'object' || !('score' in category)) {
      return null;
    }

    const score = Number(category.score);
    if (!Number.isFinite(score)) {
      return null;
    }

    total += score;
  }

  return normalizeScore(total, 'category score total');
}

export function normalizeEstimatedImprovement(beforeScore: number, afterScore: unknown, fallbackImprovement = 0): number {
  const rawImprovement = Number.isFinite(Number(afterScore))
    ? normalizeScore(afterScore, 'after_score') - beforeScore
    : Number(fallbackImprovement);

  if (!Number.isFinite(rawImprovement)) {
    return 0;
  }

  return Math.round(Math.max(0, Math.min(100 - beforeScore, rawImprovement)));
}
