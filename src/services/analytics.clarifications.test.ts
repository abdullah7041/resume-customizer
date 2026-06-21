import { afterEach, describe, expect, it, vi } from 'vitest';
import { analytics } from '@/services/analytics';

describe('clarification analytics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks response and hard-stop rates without answer content', () => {
    const track = vi.spyOn(analytics, 'track').mockImplementation(() => undefined);

    analytics.trackClarificationOutcome({
      outcome: 'answered',
      questionCount: 4,
      answeredCount: 2,
      hardStopCount: 1,
    });

    expect(track).toHaveBeenCalledWith('clarification_outcome', {
      outcome: 'answered',
      question_count: 4,
      answered_count: 2,
      hard_stop_count: 1,
      hard_stop_selection_rate: 0.25,
    });
  });

  it('tracks answered-vs-skipped score delta using buckets instead of raw scores', () => {
    const track = vi.spyOn(analytics, 'track').mockImplementation(() => undefined);

    analytics.trackClarificationScoreDelta({
      outcome: 'skipped',
      beforeScore: 42,
      afterScore: 67,
    });

    expect(track).toHaveBeenCalledWith('clarification_score_delta', {
      outcome: 'skipped',
      score_delta: 25,
      before_score_bucket: '40-59',
      after_score_bucket: '60-79',
    });
  });
});
