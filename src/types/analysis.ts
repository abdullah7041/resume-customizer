// src/types/analysis.ts
// Type definitions for match analysis, gap analysis, and keyword strategy

import type { CategoryScoresData } from '../components/ScoreBreakdown';

/**
 * Single gap analysis item from AI response
 */
export interface GapAnalysisItem {
  requirement: string;
  currentState: string;
  severity: 'critical' | 'moderate' | 'minor';
  recommendation: string;
}

/**
 * Hidden match - skills that match using different terminology
 */
export interface HiddenMatch {
  resumeTerm: string;
  jdRequirement: string;
  insight: string;
}

/**
 * Keyword strategy from AI optimization
 */
export interface KeywordStrategy {
  mirroredPhrases: string[];
  structuralChanges: string[];
  hiddenMatches: HiddenMatch[];
}

/**
 * Complete match analysis response from AI
 */
export interface MatchAnalysisResponse {
  score: number;
  coverage?: number;
  similarity?: number;
  reasoning?: string;
  missingKeywords: string[];
  topHits?: string[];
  matchedKeywords?: string[];
  strongMatches?: string[];
  suggestions?: string[];
  recommendations?: string[];
  overallAssessment?: string;
  categoryScores: CategoryScoresData | null;
  gapAnalysis: GapAnalysisItem[];
  keywordStrategy: KeywordStrategy | null;
}

/**
 * Career vulnerability types detected from work history
 */
export type VulnerabilityType = 'short_tenure' | 'gap' | 'pivot' | 'job_hopping' | 'demotion';

/**
 * Interview question with optional vulnerability coaching
 */
export interface InterviewQuestion {
  question: string;
  type: string;
  difficulty: string;
  category: string;
  answerFramework?: string;
  skills_tested?: string[];
  coachingTip?: string;
  vulnerabilityType?: VulnerabilityType;
}

/**
 * Model types for Gemini API
 */
export type GeminiModelType = 'flash' | 'lite';

/**
 * Request payload for the single-bullet correction loop (refine-bullet).
 * resumeText is the only grounding source — never fabricate beyond it.
 */
export interface RefineBulletRequest {
  original: string;
  currentImproved: string;
  userInstruction: string;
  jobContext?: string;
  resumeText: string;
  language?: 'en' | 'ar';
}

/**
 * One refined bullet. Same field shape as an optimize bullet_improvement so the
 * UI maps it with no special-casing. When the instruction asked for unsupported
 * content, `improved` equals the input bullet and `issue` explains the refusal.
 */
export interface RefineBulletResponse {
  improved: string;
  issue: string;
  rationale: string;
}

/**
 * Metadata-only provenance record for an AI-modified piece of resume data.
 * Do not store raw user instructions, resume text, job text, or AI output here.
 */
export interface AiSuggestionEntry {
  type: 'refine_bullet' | 'onboarding';
  sectionId: string;
  timestamp: string;
}
