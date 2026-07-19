/**
 * Persistence for the last Match analysis result.
 *
 * The displayed match analysis lives in MainContent component state, so a page
 * refresh used to lose it even though the score survived inside the resume
 * store's analysisCache. Mirror the truth-check localStorage pattern: store the
 * full result keyed by the exact job description it was produced for, restore
 * on mount only while the JD still matches, and clear whenever the resume or
 * match state is reset. No TTL — a result stays valid until its inputs change.
 */
import type { MatchResult, StoredMatchAnalysis } from '@/types/analysis';

export const MATCH_STORAGE_KEY = 'watheq:lastMatchAnalysis';

export function loadCachedMatchAnalysis(jobText: string): MatchResult | null {
  if (typeof window === 'undefined' || !jobText) return null;
  try {
    const stored = window.localStorage.getItem(MATCH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredMatchAnalysis;
    return parsed?.jobText === jobText && parsed.analysis && typeof parsed.analysis.score === 'number'
      ? parsed.analysis
      : null;
  } catch (error) {
    console.warn('[MatchAnalysisCache] Failed to load cached match analysis:', error);
    try {
      window.localStorage.removeItem(MATCH_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    return null;
  }
}

export function saveMatchAnalysis(analysis: MatchResult, jobText: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      MATCH_STORAGE_KEY,
      JSON.stringify({ analysis, jobText, savedAt: Date.now() } satisfies StoredMatchAnalysis),
    );
  } catch (error) {
    console.warn('[MatchAnalysisCache] Failed to persist match analysis:', error);
  }
}

export function clearStoredMatchAnalysis(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MATCH_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
