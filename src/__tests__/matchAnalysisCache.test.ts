import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MATCH_STORAGE_KEY,
  clearStoredMatchAnalysis,
  loadCachedMatchAnalysis,
  loadStoredMatchAssessment,
  saveMatchAssessment,
  saveMatchAnalysis,
} from '@/lib/utils/matchAnalysisCache';
import type { MatchResult } from '@/types/analysis';
import { createAssessmentContext } from '@/lib/match/assessmentContext';
import type { AssessmentRecord } from '@/types/assessment';

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

  it('restores old records explicitly as legacy without admitting them as current', async () => {
    const context = await createAssessmentContext({
      resumeText: 'Candidate resume', jobDescription: JOB_TEXT,
      language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1',
    });
    saveMatchAnalysis(sampleResult, JOB_TEXT);
    expect(loadStoredMatchAssessment(context)).toMatchObject({
      status: 'legacy', analysis: sampleResult, jobText: JOB_TEXT,
    });
  });

  it('round-trips a full assessment and marks mismatched context outdated', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const context = await createAssessmentContext({
      resumeText: 'Candidate resume', jobDescription: JOB_TEXT,
      language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1',
    });
    const assessment: AssessmentRecord<MatchResult> = {
      context, jobSnapshot: JOB_TEXT, requestId: 'request-1',
      createdAt: '2026-09-24T00:00:00.000Z', result: sampleResult,
    };
    saveMatchAssessment(assessment);
    expect(loadStoredMatchAssessment(context)).toEqual({ status: 'current', assessment });
    expect(loadStoredMatchAssessment({ ...context, rubricVersion: 'match-v2' })).toEqual({ status: 'outdated', assessment });
    expect(loadCachedMatchAnalysis(JOB_TEXT)).toEqual(sampleResult);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
