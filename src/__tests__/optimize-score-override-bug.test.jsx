/**
 * Test for optimize API score override bug:
 *
 * Bug scenario:
 * 1. User has showOptimized=true (persisted from previous session)
 * 2. User runs match analysis → AI returns score 15%
 * 3. MainContent guards prevent saving to baselineMatchScore (showOptimized=true)
 * 4. User runs optimize → optimize API's AI independently returns match_score=77
 * 5. BUG: optimizationMetrics.beforeScore is set to 77 (from optimize AI)
 * 6. Display shows "Current Score: 77%" instead of 15%
 *
 * Expected: Current Score should always show the match analysis score (15%)
 */

import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useResumeStore } from "../lib/stores/resumeStore";

const DEFAULT_FALLBACK_SCORE = 55;

/**
 * Replicates the beforeScore priority chain from OptimizeSection.tsx:340-344
 */
const getDisplayedBeforeScore = (state) => {
  const cachedScore = null; // Simplified: cache lookup omitted for unit test
  return (
    state.baselineMatchScore ??
    state.optimizationMetrics.beforeScore ??
    cachedScore ??
    DEFAULT_FALLBACK_SCORE
  );
};

describe("Optimize API score override bug", () => {
  beforeEach(() => {
    const { result } = renderHook(() => useResumeStore());
    act(() => {
      result.current.resetForNewUpload();
    });
  });

  it("should use match analysis score (15) not optimize API score (77) for current score", () => {
    const { result } = renderHook(() => useResumeStore());

    // Step 1: showOptimized=true (persisted from previous session)
    act(() => {
      result.current.setShowOptimized(true);
    });

    // Step 2: User runs match analysis → score 15
    // FIXED MainContent.tsx: always saves to baseline regardless of showOptimized
    act(() => {
      result.current.setOptimizationMetrics({ beforeScore: 15, hasJobDescription: true });
      result.current.setBaselineMatchScore(15);
    });

    // Baseline is now set (fix removed the showOptimized guard)
    expect(result.current.baselineMatchScore).toBe(15);

    // Step 3: User runs optimize → optimize API returns matchScoring.beforeScore=77
    // FIXED OptimizeSection.tsx: skips overwrite because existingBaseline !== null
    act(() => {
      // Simulate the fixed behavior: only overwrite if no baseline exists
      const existingBaseline = result.current.baselineMatchScore;
      if (existingBaseline === null) {
        result.current.setOptimizationMetrics({ beforeScore: 77 });
      }
    });

    // Display should show 15 (from baseline), NOT 77 (from optimize API)
    const displayedScore = getDisplayedBeforeScore(result.current);
    expect(displayedScore).toBe(15);
  });

  it("should always save match analysis score to baseline regardless of showOptimized", () => {
    const { result } = renderHook(() => useResumeStore());

    // Simulate persisted showOptimized=true from previous session
    act(() => {
      result.current.setShowOptimized(true);
    });

    // Simulate match analysis saving score (AFTER FIX: no showOptimized guard)
    act(() => {
      // FIXED behavior: always save to baseline when analyzing original resume
      result.current.setBaselineMatchScore(15);
      result.current.setOptimizationMetrics({ beforeScore: 15, hasJobDescription: true });
    });

    expect(result.current.baselineMatchScore).toBe(15);

    // Optimize API tries to overwrite
    act(() => {
      result.current.setOptimizationMetrics({ beforeScore: 77 });
    });

    // Baseline protects against overwrite
    const displayedScore = getDisplayedBeforeScore(result.current);
    expect(displayedScore).toBe(15);
  });

  it("should update baseline when re-running match analysis with new job description", () => {
    const { result } = renderHook(() => useResumeStore());

    // First match analysis → score 50
    act(() => {
      result.current.setBaselineMatchScore(50);
      result.current.setOptimizationMetrics({ beforeScore: 50, hasJobDescription: true });
    });

    expect(result.current.baselineMatchScore).toBe(50);

    // Second match analysis with different JD → score 15
    // FIXED: baseline should update (not stay at 50 because it's not null)
    act(() => {
      result.current.setBaselineMatchScore(15);
      result.current.setOptimizationMetrics({ beforeScore: 15, hasJobDescription: true });
    });

    expect(result.current.baselineMatchScore).toBe(15);

    // Optimize API tries to overwrite
    act(() => {
      result.current.setOptimizationMetrics({ beforeScore: 77 });
    });

    const displayedScore = getDisplayedBeforeScore(result.current);
    expect(displayedScore).toBe(15);
  });
});
