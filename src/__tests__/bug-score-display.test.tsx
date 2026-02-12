/**
 * Bug 1: Optimized score not displaying
 *
 * Root cause: OptimizeSection was setting metricsToUpdate.afterScore = null
 * which discarded the real AI-calculated afterScore from data.matchScoring.afterScore.
 *
 * This test verifies the actual source code preserves afterScore from the API response.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Bug 1 – afterScore preserved from API', () => {
    it('OptimizeSection.tsx preserves matchScoring.afterScore from API', () => {
        // Read actual source code to verify the fix
        const optimizeSectionPath = join(__dirname, '../components/sections/OptimizeSection.tsx');
        const source = readFileSync(optimizeSectionPath, 'utf-8');

        // Find the metrics update logic (around line 605)
        // Should contain: metricsToUpdate.afterScore = data.matchScoring.afterScore ?? null;
        const afterScorePattern = /metricsToUpdate\.afterScore\s*=\s*data\.matchScoring\.afterScore\s*\?\?\s*null/;
        const hasCorrectPattern = afterScorePattern.test(source);

        expect(hasCorrectPattern).toBe(true);
    });

    it('OptimizeSection.tsx does NOT hardcode afterScore = null', () => {
        const optimizeSectionPath = join(__dirname, '../components/sections/OptimizeSection.tsx');
        const source = readFileSync(optimizeSectionPath, 'utf-8');

        // Search for the bug pattern: metricsToUpdate.afterScore = null (hardcoded)
        // This would discard the API value
        const bugPattern = /metricsToUpdate\.afterScore\s*=\s*null(?!\s*\/\/)/;
        const hasBug = bugPattern.test(source);

        expect(hasBug).toBe(false);
    });

    it('OptimizeSection.tsx uses estimatedImprovement (not afterScore) for improvement metric', () => {
        const optimizeSectionPath = join(__dirname, '../components/sections/OptimizeSection.tsx');
        const source = readFileSync(optimizeSectionPath, 'utf-8');

        // Verify that improvement uses estimatedImprovement from backend
        const improvementPattern = /metricsToUpdate\.improvement\s*=\s*data\.matchScoring\.estimatedImprovement/;
        const hasCorrectPattern = improvementPattern.test(source);

        expect(hasCorrectPattern).toBe(true);
    });
});
