// Template system types - extends JSON Resume schema
import type { ResumeSchema } from './resume';

/**
 * Available template identifiers
 */
export type TemplateId =
  | 'modern-professional'
  | 'classic-traditional'
  | 'technical-engineer'
  | 'ats-optimized';

/**
 * Template category for filtering
 */
export type TemplateCategory = 'modern' | 'classic' | 'technical';

/**
 * Template configuration metadata
 */
export interface TemplateConfig {
  id: TemplateId;
  name: string;
  nameAr: string;
  category: TemplateCategory;
  description: string;
  descriptionAr: string;
  isAtsOptimized: boolean;
  previewColor: string;
}

/**
 * Optimization result for a single section
 */
export interface OptimizationResult {
  sectionId: string;
  sectionType: 'summary' | 'experience' | 'skills' | 'projects' | 'headline' | 'education' | 'certifications';
  original: string | string[];
  optimized: string | string[];
  applied: boolean;
  timestamp?: string;
}

/**
 * Keyword suggestion for optimization
 */
export interface KeywordSuggestion {
  keyword: string;
  category: 'add' | 'keep' | 'deemphasize';
}

/**
 * Diagnostics for merge operations
 * Tracks success/failure of optimization application during merging
 */
export interface MergeDiagnostics {
  /** Number of optimizations successfully applied */
  appliedCount: number;
  /** Number of optimizations that failed to match */
  failedCount: number;
  /** Details of failed matches for debugging */
  failedMatches: Array<{
    sectionType: string;
    sectionId: string;
    originalPreview: string;
  }>;
}

/**
 * Extended work experience with optimization tracking
 */
export interface OptimizedWork {
  id: string;
  originalHighlights?: string[];
  isOptimized?: boolean;
}

/**
 * Cached analysis result for consistent match scores
 */
export interface CachedAnalysis {
  score: number;
  coverage?: number;
  similarity?: number;
  missingKeywords: string[];
  matchedKeywords?: string[];
  strongMatches?: string[];
  recommendations?: string[];
  suggestions?: string[];
  reasoning?: string;
  overallAssessment?: string;
  timestamp: number;
}

/**
 * Analysis cache keyed by fingerprint
 */
export interface AnalysisCache {
  [key: string]: CachedAnalysis;
}

/**
 * Optimization metrics for Results Summary
 * Tracks scoring data from the API for displaying match improvements
 */
export interface OptimizationMetrics {
  beforeScore: number | null;
  afterScore: number | null;
  improvement: number | null;
  jdKeywords: string[];
  matchedKeywords: string[];
  reasoning: string | null;
  hasJobDescription: boolean;
  // Vision 2030 alignment data
  vision2030: {
    overallScore: number;
    primarySector: { id: string; nameEn: string; nameAr: string; icon: string } | null;
    secondarySectors: { id: string; nameEn: string; nameAr: string; icon: string }[];
    matchedSkillsCount: number;
    topMatchedSkills: string[];
    detectedCareer: { nameEn: string; nameAr: string } | null;
  } | null;
  // Gap analysis data from API
  gapAnalysis?: {
    requirement: string;
    currentState: string;
    severity: 'critical' | 'moderate' | 'minor';
    recommendation: string;
  }[];
  // Keyword strategy from API
  keywordStrategy?: {
    mirroredPhrases?: string[];
    structuralChanges?: string[];
    hiddenMatches?: {
      resumeTerm: string;
      jdRequirement: string;
      insight: string;
    }[];
  };
  // Category scores from API
  categoryScores?: {
    hard_skills?: { score: number; max: number; reasoning: string };
    experience?: { score: number; max: number; reasoning: string };
    education?: { score: number; max: number; reasoning: string };
    soft_skills?: { score: number; max: number; reasoning: string };
  } | null;
  // Score breakdown from API
  scoreBreakdown?: {
    base_score: number;
    skill_match_bonus: number;
    keyword_coverage_bonus: number;
    gap_penalties: number;
    final_score: number;
    score_explanation: string;
  };
}

/**
 * Display options for template rendering (user-adjustable)
 */
export interface DisplayOptions {
  fontSize: number; // Scale factor: 1 = 100%, 0.9 = 90%, 1.1 = 110%
}

/**
 * Resume state for the store
 */
export interface ResumeState {
  // Core data
  originalResume: ResumeSchema | null;
  parsedResumeText: string | null;
  optimizations: OptimizationResult[];
  keywordSuggestions: KeywordSuggestion[];

  // Analysis caching for consistent results
  analysisCache: AnalysisCache;

  // Optimization metrics for Results Summary
  optimizationMetrics: OptimizationMetrics;

  // View state
  showOptimized: boolean;
  selectedTemplate: TemplateId;
  displayOptions: DisplayOptions;

  // Actions
  setOriginalResume: (resume: ResumeSchema) => void;
  addOptimization: (optimization: Omit<OptimizationResult, 'timestamp'>) => void;
  applyOptimization: (id: string) => void;
  revertOptimization: (id: string) => void;
  setParsedResumeText: (text: unknown) => void;
  setOptimizations: (opts: OptimizationResult[]) => void;
  applyAllOptimizations: () => void;
  revertAllOptimizations: () => void;
  toggleShowOptimized: () => void;
  setShowOptimized: (_show: boolean) => void;
  setSelectedTemplate: (_id: TemplateId) => void;
  setKeywordSuggestions: (_suggestions: KeywordSuggestion[]) => void;
  getActiveResume: () => ResumeSchema | null;
  clearAll: () => void;
  resetForNewUpload: () => void;

  // Optimization metrics actions
  setOptimizationMetrics: (metrics: Partial<OptimizationMetrics>) => void;
  resetOptimizationMetrics: () => void;

  // Cache actions
  getCachedAnalysis: (resumeText: string, jobDescription: string) => CachedAnalysis | null;
  setCachedAnalysis: (resumeText: string, jobDescription: string, analysis: Omit<CachedAnalysis, 'timestamp'>) => void;
  clearAnalysisCache: () => void;

  // Display options actions
  setDisplayOptions: (options: Partial<DisplayOptions>) => void;
}

/**
 * Template component props
 */
export interface TemplateProps {
  resume: ResumeSchema;
  isAtsMode?: boolean;
  scale?: number;
}

/**
 * PDF export options
 */
export interface PdfExportOptions {
  format: 'styled' | 'ats';
  templateHtml?: string;
  fileName?: string;
}




