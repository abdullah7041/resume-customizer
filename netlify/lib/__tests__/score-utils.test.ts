import { describe, expect, it } from 'vitest';
import {
  normalizeEstimatedImprovement,
  normalizeScore,
  scoreFromCategoryScores,
} from '../score-utils.js';

describe('score-utils', () => {
  it('rounds and clamps scores to 0..100', () => {
    expect(normalizeScore(82.4)).toBe(82);
    expect(normalizeScore(-10)).toBe(0);
    expect(normalizeScore(150)).toBe(100);
    expect(normalizeScore('67.8')).toBe(68);
  });

  it('rejects missing or invalid scores', () => {
    expect(() => normalizeScore(undefined, 'match_score')).toThrow('match_score');
    expect(() => normalizeScore('not-a-score', 'match_score')).toThrow('match_score');
  });

  it('derives category score totals from valid complete category scores', () => {
    expect(scoreFromCategoryScores({
      hard_skills: { score: 30 },
      experience: { score: 20 },
      education: { score: 10 },
      soft_skills: { score: 5 },
    })).toBe(65);
  });

  it('clamps complete category score totals', () => {
    expect(scoreFromCategoryScores({
      hard_skills: { score: 80 },
      experience: { score: 40 },
      education: { score: 10 },
      soft_skills: { score: 5 },
    })).toBe(100);
  });

  it('returns null for empty category scores', () => {
    expect(scoreFromCategoryScores({})).toBeNull();
  });

  it('returns null for partial category scores', () => {
    expect(scoreFromCategoryScores({
      hard_skills: { score: 30 },
      experience: { score: 20 },
    })).toBeNull();
  });

  it('returns null when a required category is missing a score field', () => {
    expect(scoreFromCategoryScores({
      hard_skills: { score: 30 },
      experience: { score: 20 },
      education: {},
      soft_skills: { score: 5 },
    })).toBeNull();
  });

  it('returns null when a required category score is non-numeric', () => {
    expect(scoreFromCategoryScores({
      hard_skills: { score: 30 },
      experience: { score: 'not-a-score' },
      education: { score: 10 },
      soft_skills: { score: 5 },
    })).toBeNull();
  });

  it('caps estimated improvement so projected score cannot exceed 100', () => {
    expect(normalizeEstimatedImprovement(95, 150, 15)).toBe(5);
    expect(normalizeEstimatedImprovement(70, 65, 15)).toBe(0);
    expect(normalizeEstimatedImprovement(90, undefined, 15)).toBe(10);
  });
});
