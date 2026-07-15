import { describe, expect, it } from 'vitest';
import { scoreBandFlags } from '../../scripts/lib/optimize-score-band.mjs';

describe('optimize score-band validation', () => {
  it('flags a missing expected band instead of silently opting out', () => {
    expect(scoreBandFlags({ match_score: 70, after_score: 80 }, {})).toContain(
      'match_score_band_missing_or_invalid',
    );
  });

  it.each([
    [['50', 80]],
    [[80, 50]],
    [[-1, 50]],
    [[50, 101]],
  ])('flags malformed band %j', (matchScoreBand) => {
    expect(
      scoreBandFlags(
        { match_score: 70, after_score: 80 },
        { expected: { matchScoreBand } },
      ),
    ).toContain('match_score_band_missing_or_invalid');
  });

  it('checks match, after, and range constraints for a valid band', () => {
    expect(
      scoreBandFlags(
        { match_score: 91, after_score: 89 },
        { expected: { matchScoreBand: [50, 85] } },
      ),
    ).toEqual([
      'match_score_out_of_band:91 not in [50,85]',
      'after_score_below_match:89<91',
    ]);
  });
});
