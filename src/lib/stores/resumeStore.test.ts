import { describe, it, expect, beforeEach } from 'vitest';
import { useResumeStore } from './resumeStore';

describe('resumeStore', () => {
    beforeEach(() => {
        useResumeStore.getState().clearAll();
    });

    it('should initialize gapAnalysis as an empty array, not null', () => {
        useResumeStore.getState().resetOptimizationMetrics();
        const updatedState = useResumeStore.getState();
        expect(updatedState.optimizationMetrics.gapAnalysis).toEqual([]);
    });

    it('should update optimization metrics correctly with consolidated updates', () => {
        const metricsPayload = {
            beforeScore: 75,
            afterScore: 85,
            gapAnalysis: [{
                requirement: 'Test Requirement',
                currentState: 'Missing',
                severity: 'critical' as const,
                recommendation: 'Add it'
            }],
            categoryScores: { hard_skills: { score: 10, max: 10, reasoning: 'test' } }
        };

        useResumeStore.getState().setOptimizationMetrics(metricsPayload);

        const state = useResumeStore.getState();
        expect(state.optimizationMetrics.beforeScore).toBe(75);
        expect(state.optimizationMetrics.afterScore).toBe(85);
        expect(state.optimizationMetrics.gapAnalysis).toHaveLength(1);
        expect(state.optimizationMetrics.categoryScores).toEqual({ hard_skills: { score: 10, max: 10, reasoning: 'test' } });
    });

    it('should reset all fields correctly including gapAnalysis and hasDownloaded', () => {
        useResumeStore.getState().setOptimizationMetrics({
            gapAnalysis: [{
                requirement: 'Old Req',
                currentState: 'Old State',
                severity: 'minor' as const,
                recommendation: 'Fix it'
            }],
            beforeScore: 50
        });
        useResumeStore.getState().setHasDownloaded(true);

        useResumeStore.getState().resetForNewUpload();

        const state = useResumeStore.getState();
        expect(state.optimizationMetrics.gapAnalysis).toEqual([]);
        expect(state.optimizationMetrics.beforeScore).toBeNull();
        expect(state.hasDownloaded).toBe(false);
    });

    it('should reset hasDownloaded when resume content changes', () => {
        useResumeStore.getState().setHasDownloaded(true);
        expect(useResumeStore.getState().hasDownloaded).toBe(true);

        // Simulate changing template - should reset
        useResumeStore.getState().setSelectedTemplate('classic-traditional');
        expect(useResumeStore.getState().hasDownloaded).toBe(false);

        // Reset and test another action
        useResumeStore.getState().setHasDownloaded(true);
        useResumeStore.getState().setShowOptimized(true);
        expect(useResumeStore.getState().hasDownloaded).toBe(false);
    });
});
