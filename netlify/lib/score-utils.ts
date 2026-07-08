export function normalizeScore(value: unknown, label = 'score'): number {
  const rawScore = Number(value);

  if (!Number.isFinite(rawScore)) {
    throw new Error(`AI response missing valid ${label}`);
  }

  const score = rawScore > 0 && rawScore < 1 ? rawScore * 100 : rawScore;
  if (score !== rawScore) {
    console.log(`[score-utils] rescaled fraction score ${rawScore} -> ${score}`);
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

const REQUIRED_CATEGORY_SCORE_KEYS = [
  'hard_skills',
  'experience',
  'education',
  'soft_skills',
] as const;

export function scoreFromCategoryScores(categoryScores: unknown): number | null {
  if (!categoryScores || typeof categoryScores !== 'object') {
    return null;
  }

  const scores = categoryScores as Record<string, unknown>;

  let total = 0;

  for (const key of REQUIRED_CATEGORY_SCORE_KEYS) {
    const category = scores[key];
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
