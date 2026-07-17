import { describe, expect, it } from 'vitest';
import {
  RECOMMENDATION_ONLY_SECTION_TYPES,
  getActionability,
  isActionable,
  isRecommendationOnly,
  partitionOptimizations,
} from '../actionability';
import type { OptimizationResult } from '@/types/templates';

const card = (sectionType: OptimizationResult['sectionType'], applied = false): OptimizationResult => ({
  sectionId: `${sectionType}-0`,
  sectionType,
  original: 'before',
  optimized: 'after',
  applied,
});

describe('actionability', () => {
  it('classifies every section type deterministically', () => {
    expect(getActionability('headline')).toBe('actionable');
    expect(getActionability('summary')).toBe('actionable');
    expect(getActionability('experience')).toBe('actionable');
    expect(getActionability('education')).toBe('actionable');
    expect(getActionability('projects')).toBe('actionable');
    expect(getActionability('skills')).toBe('recommendation');
    expect(getActionability('certifications')).toBe('recommendation');
    // Legacy fallback cards are headline/summary shaped.
    expect(getActionability('general')).toBe('actionable');
  });

  it('exposes exactly skills + certifications as recommendation-only', () => {
    expect([...RECOMMENDATION_ONLY_SECTION_TYPES].sort()).toEqual(['certifications', 'skills']);
  });

  it('isActionable / isRecommendationOnly are complementary', () => {
    const types: OptimizationResult['sectionType'][] = [
      'summary', 'experience', 'skills', 'projects', 'headline', 'education', 'certifications',
    ];
    for (const t of types) {
      expect(isActionable({ sectionType: t })).toBe(!isRecommendationOnly({ sectionType: t }));
    }
  });

  it('partitions a mixed queue preserving order within each bucket', () => {
    const cards = [
      card('headline'),
      card('skills'),
      card('experience'),
      card('certifications'),
      card('summary'),
    ];
    const { actionable, recommendations } = partitionOptimizations(cards);
    expect(actionable.map((c) => c.sectionType)).toEqual(['headline', 'experience', 'summary']);
    expect(recommendations.map((c) => c.sectionType)).toEqual(['skills', 'certifications']);
  });
});
