import { describe, expect, it } from 'vitest';
import { CAREER_LEVELS, getCareerLevel, getLevelUp } from '../careerLevels';

describe('careerLevels', () => {
  it('covers 0-100 contiguously with five levels', () => {
    expect(CAREER_LEVELS).toHaveLength(5);
    expect(CAREER_LEVELS[0].min).toBe(0);
    expect(CAREER_LEVELS[4].max).toBe(100);
    for (let i = 1; i < CAREER_LEVELS.length; i++) {
      expect(CAREER_LEVELS[i].min).toBe(CAREER_LEVELS[i - 1].max + 1);
    }
  });

  it.each([
    [0, 1], [39, 1],
    [40, 2], [59, 2],
    [60, 3], [69, 3],
    [70, 4], [79, 4],
    [80, 5], [100, 5],
  ])('maps score %i to level %i', (score, index) => {
    expect(getCareerLevel(score).index).toBe(index);
  });

  it('keeps the character-art boundaries at the established 60/80 cutoffs', () => {
    expect(getCareerLevel(59).artTier).toBe('struggling');
    expect(getCareerLevel(60).artTier).toBe('confident');
    expect(getCareerLevel(79).artTier).toBe('confident');
    expect(getCareerLevel(80).artTier).toBe('celebrating');
    // Levels 1→2 and 3→4 are level-ups within the SAME art tier.
    expect(getCareerLevel(39).artTier).toBe(getCareerLevel(40).artTier);
    expect(getCareerLevel(69).artTier).toBe(getCareerLevel(70).artTier);
  });

  it('clamps out-of-range and non-finite scores', () => {
    expect(getCareerLevel(-10).index).toBe(1);
    expect(getCareerLevel(140).index).toBe(5);
    expect(getCareerLevel(Number.NaN).index).toBe(1);
    expect(getCareerLevel(59.6).index).toBe(3); // rounds like the displayed score
  });

  it('detects level-ups only on upward boundary crossings', () => {
    expect(getLevelUp(35, 45)).toBe(true);   // 1 → 2
    expect(getLevelUp(58, 63)).toBe(true);   // 2 → 3
    expect(getLevelUp(75, 85)).toBe(true);   // 4 → 5
    expect(getLevelUp(41, 59)).toBe(false);  // within level 2
    expect(getLevelUp(63, 61)).toBe(false);  // within level 3
    expect(getLevelUp(85, 45)).toBe(false);  // decrease is never a level-up
    expect(getLevelUp(null, 90)).toBe(false);
    expect(getLevelUp(50, null)).toBe(false);
  });
});
