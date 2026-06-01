// src/__tests__/honest-scoring.test.jsx
// TDD tests for honest scoring system - ensures no fabricated scores

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Honest Scoring System', () => {
  // Test A: AI rubric prompt does NOT contain prescriptive scoring language
  describe('AI Scoring Rubric', () => {
    const aiContractPath = join(__dirname, '../../netlify/lib/ai-contracts/contracts/index.js');
    let aiContractSource;

    try {
      aiContractSource = readFileSync(aiContractPath, 'utf-8');
    } catch {
      aiContractSource = '';
    }

    it('should NOT contain "should score 85-95" in rubric', () => {
      expect(aiContractSource).not.toContain('should score 85-95');
    });

    it('should NOT contain "Be GENEROUS" bias language', () => {
      expect(aiContractSource.toUpperCase()).not.toContain('BE GENEROUS');
    });

    it('should NOT tell AI what an optimized resume "should" score', () => {
      expect(aiContractSource).not.toContain('optimized match should score');
      expect(aiContractSource).not.toContain('excellent/optimized match should score');
    });

    it('should contain evidence-based scoring criteria', () => {
      // The rubric should use evidence-based language
      expect(aiContractSource).toContain('demonstrated proficiency');
    });
  });

  // Test B: Backend optimize response has estimatedImprovement, not afterScore formula
  describe('Backend Optimize Response', () => {
    const optimizePath = join(__dirname, '../../netlify/functions/optimize.ts');
    let optimizeSource;

    try {
      optimizeSource = readFileSync(optimizePath, 'utf-8');
    } catch {
      optimizeSource = '';
    }

    it('should NOT contain fake cardBonus formula', () => {
      // Should not have "cards.length * 3" formula
      expect(optimizeSource).not.toMatch(/cards\.length\s*\*\s*3/);
    });

    it('should NOT contain hardcoded 95 cap in afterScore', () => {
      // Should not cap scores at 95
      expect(optimizeSource).not.toMatch(/Math\.min\([^)]*,\s*95\)/);
    });

    it('should have estimatedImprovement instead of afterScore', () => {
      expect(optimizeSource).toContain('estimatedImprovement');
    });
  });

  // Test C: No hardcoded 95 cap in frontend
  describe('Frontend Score Display', () => {
    const optimizeSectionPath = join(__dirname, '../components/sections/OptimizeSection.tsx');
    let optimizeSectionSource;

    try {
      optimizeSectionSource = readFileSync(optimizeSectionPath, 'utf-8');
    } catch {
      optimizeSectionSource = '';
    }

    it('should NOT cap afterScore at 95 in frontend', () => {
      // The frontend should not have Math.min(..., 95) for score capping
      expect(optimizeSectionSource).not.toMatch(/Math\.min\([^)]*,\s*95\)/);
    });

    it('should show "projected" or "estimated" label when score is not verified', () => {
      // The UI should indicate when a score is estimated vs genuine
      expect(optimizeSectionSource).toMatch(/estimated|projected|Estimated|Projected|Verify/i);
    });
  });
});
