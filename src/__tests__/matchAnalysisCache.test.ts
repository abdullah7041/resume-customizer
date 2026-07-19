import { beforeEach, describe, expect, it } from 'vitest';
import {
  MATCH_STORAGE_KEY,
  clearStoredMatchAnalysis,
  loadCachedMatchAnalysis,
  saveMatchAnalysis,
} from '@/lib/utils/matchAnalysisCache';
import type { MatchResult } from '@/components/sections/MatchSection';

const sampleResult: MatchResult = {
  score: 62,
  matchedKeywords: ['React', 'TypeScript'],
  missingKeywords: ['Kubernetes'],
  reasoning: 'Solid frontend overlap with infrastructure gaps.',
};

const JOB_TEXT = 'Frontend engineer building React dashboards in Riyadh.';

describe('matchAnalysisCache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a match result keyed by the exact job description', () => {
    saveMatchAnalysis(sampleResult, JOB_TEXT);
    expect(loadCachedMatchAnalysis(JOB_TEXT)).toEqual(sampleResult);
  });

  it('returns null when the job description has changed', () => {
    saveMatchAnalysis(sampleResult, JOB_TEXT);
    expect(loadCachedMatchAnalysis('A different job description entirely.')).toBeNull();
  });

  it('returns null for an empty job description', () => {
    saveMatchAnalysis(sampleResult, JOB_TEXT);
    expect(loadCachedMatchAnalysis('')).toBeNull();
  });

  it('clears the stored result', () => {
    saveMatchAnalysis(sampleResult, JOB_TEXT);
    clearStoredMatchAnalysis();
    expect(loadCachedMatchAnalysis(JOB_TEXT)).toBeNull();
    expect(window.localStorage.getItem(MATCH_STORAGE_KEY)).toBeNull();
  });

  it('drops corrupt stored payloads instead of throwing', () => {
    window.localStorage.setItem(MATCH_STORAGE_KEY, '{not json');
    expect(loadCachedMatchAnalysis(JOB_TEXT)).toBeNull();
    expect(window.localStorage.getItem(MATCH_STORAGE_KEY)).toBeNull();
  });

  it('rejects payloads without a numeric score', () => {
    window.localStorage.setItem(
      MATCH_STORAGE_KEY,
      JSON.stringify({ analysis: { score: 'high' }, jobText: JOB_TEXT }),
    );
    expect(loadCachedMatchAnalysis(JOB_TEXT)).toBeNull();
  });
});
