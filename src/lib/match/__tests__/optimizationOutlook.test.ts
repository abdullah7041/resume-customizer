import { describe, expect, it } from 'vitest';
import { computeOptimizationOutlook } from '../optimizationOutlook';
import type { ConfirmedRisk, StrategicRealityCheck } from '@/types/analysis';

function makeRisk(title: string, overrides: Partial<ConfirmedRisk> = {}): ConfirmedRisk {
  return {
    type: 'requirement_gap',
    severity: 'high',
    title,
    explanation: 'explanation',
    mitigation: 'mitigation',
    ...overrides,
  };
}

function makeRealityCheck(overrides: Partial<StrategicRealityCheck> = {}): StrategicRealityCheck {
  return {
    riskTier: 'low',
    recommendation: 'optimize_now',
    confidence: 'high',
    riskTypes: [],
    summary: 'summary',
    strengths: [],
    confirmedRisks: [],
    unclearRisks: [],
    limits: { cannotDetermine: [], assumptions: [] },
    ...overrides,
  };
}

describe('computeOptimizationOutlook', () => {
  it('returns null when there is no score yet', () => {
    expect(computeOptimizationOutlook(null, null)).toBeNull();
    expect(computeOptimizationOutlook(undefined, null)).toBeNull();
    expect(computeOptimizationOutlook(Number.NaN, null)).toBeNull();
  });

  it('is low_ceiling below 35 regardless of risks', () => {
    expect(computeOptimizationOutlook(34, null)?.band).toBe('low_ceiling');
    expect(computeOptimizationOutlook(0, makeRealityCheck())?.band).toBe('low_ceiling');
  });

  it('is worth_it_with_gaps in the 35-54 range with no confirmed risks', () => {
    expect(computeOptimizationOutlook(35, null)?.band).toBe('worth_it_with_gaps');
    expect(computeOptimizationOutlook(54, makeRealityCheck())?.band).toBe('worth_it_with_gaps');
  });

  it('is high_potential at 55+ with zero confirmed risks', () => {
    expect(computeOptimizationOutlook(55, makeRealityCheck())?.band).toBe('high_potential');
    expect(computeOptimizationOutlook(90, null)?.band).toBe('high_potential');
  });

  it('downgrades a 55+ score to worth_it_with_gaps with exactly one confirmed risk', () => {
    const realityCheck = makeRealityCheck({ confirmedRisks: [makeRisk('Missing required certification')] });
    expect(computeOptimizationOutlook(80, realityCheck)?.band).toBe('worth_it_with_gaps');
  });

  it('caps at low_ceiling with two or more confirmed risks, even at a high score', () => {
    const realityCheck = makeRealityCheck({
      confirmedRisks: [makeRisk('Missing required degree'), makeRisk('Under the required years of experience')],
    });
    expect(computeOptimizationOutlook(90, realityCheck)?.band).toBe('low_ceiling');
  });

  it('caps at low_ceiling when riskTier is critical, even with zero confirmed risks', () => {
    const realityCheck = makeRealityCheck({ riskTier: 'critical', confirmedRisks: [] });
    expect(computeOptimizationOutlook(95, realityCheck)?.band).toBe('low_ceiling');
  });

  it('returns blocker titles from confirmedRisks, capped at 3', () => {
    const realityCheck = makeRealityCheck({
      confirmedRisks: [
        makeRisk('Missing required degree'),
        makeRisk('Under the required years of experience'),
        makeRisk('No visa sponsorship history'),
        makeRisk('No industry-specific certification'),
      ],
    });
    const outlook = computeOptimizationOutlook(20, realityCheck);
    expect(outlook?.blockers).toEqual([
      'Missing required degree',
      'Under the required years of experience',
      'No visa sponsorship history',
    ]);
  });

  it('returns an empty blockers list when there is no reality check', () => {
    expect(computeOptimizationOutlook(60, null)?.blockers).toEqual([]);
  });
});
