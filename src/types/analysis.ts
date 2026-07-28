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
  summary_bullets?: string[];
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

/** Complete match result shared by the API flow, cache, and presentation layer. */
export interface MatchResult {
  score: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  topHits?: string[];
  suggestions?: string[];
  summary_bullets?: string[];
  reasoning?: string;
  categoryScores?: CategoryScoresData | null;
  gapAnalysis?: GapAnalysisItem[];
  keywordStrategy?: {
    mirroredPhrases?: string[];
    structuralChanges?: string[];
    hiddenMatches?: HiddenMatch[];
  } | null;
  strategicRealityCheck?: StrategicRealityCheck | null;
  interviewPrep?: {
    predicted_questions?: InterviewQuestion[];
    role_level?: string;
    focus_areas?: string[];
  };
  /**
   * Set client-side (not returned by the API) right after the request: 'guest_preview'
   * when this result came from the free/guest preview path (no credits charged),
   * 'paid' otherwise. A subsequent paid re-run over the same job overwrites it.
   */
  origin?: 'guest_preview' | 'paid';
  /** True when this request consumed the one-shot "first applied-subset
   * re-score per job" free allowance (see ai-match.ts) instead of charging. */
  freeVerify?: boolean;
}

export interface StoredMatchAnalysis {
  analysis?: MatchResult;
  jobText?: string;
  savedAt?: number;
}

/**
 * A short, source-attributed evidence snippet. Snippets are verified
 * server-side (netlify/lib/strategic-reality-check.js) — those without
 * sufficient token overlap with the source text are stripped/downgraded,
 * so the client renders them verbatim without risk of fabrication.
 */
export interface RealityCheckEvidence {
  source: 'resume' | 'job_description' | 'both';
  snippet: string;
}

/**
 * A confirmed strength of the resume against the job description.
 */
export interface RealityCheckStrength {
  title: string;
  whyItMatters?: string;
  evidence?: RealityCheckEvidence[];
}

/**
 * A confirmed risk / red flag with mitigation guidance.
 */
export interface ConfirmedRisk {
  type: string;
  severity: 'medium' | 'high' | 'critical';
  title: string;
  explanation: string;
  mitigation: string;
  evidence?: RealityCheckEvidence[];
}

/**
 * A risk that could not be confirmed from the documents alone.
 */
export interface UnclearRisk {
  type: string;
  topic: string;
  reason: string;
  evidenceNeeded: string;
}

/**
 * Strategic reality check from processMatchOnly. Every array is already
 * normalized/clamped server-side; the frontend treats it as read-only
 * evidence and never re-scores from it.
 */
export interface StrategicRealityCheck {
  riskTier: 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'optimize_now' | 'answer_clarifications_first' | 'add_evidence_first' | 'review_role_fit';
  confidence: 'low' | 'medium' | 'high';
  riskTypes: string[];
  summary: string;
  strengths: RealityCheckStrength[];
  confirmedRisks: ConfirmedRisk[];
  unclearRisks: UnclearRisk[];
  limits: {
    cannotDetermine: string[];
    assumptions: string[];
  };
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
