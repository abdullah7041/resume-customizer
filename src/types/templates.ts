// Template system types - extends JSON Resume schema
import type { PartialResumeSchema, ResumeSchema } from './resume';
import type { SearchIntent } from './onboarding';
import type { StrategicRealityCheck } from './analysis';
import type { CategoryScoresData } from '../components/ScoreBreakdown';

/**
 * Available template identifiers
 */
export type TemplateId =
  | 'modern-professional'
  | 'technical-engineer'
  | 'ats-optimized'
  | 'executive-professional';

/**
 * Template category for filtering
 */
export type TemplateCategory = 'modern' | 'classic' | 'technical' | 'ats' | 'executive';

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
  // Set when the bullet was refined via the single-bullet correction loop.
  // `issue` explains a refusal (e.g. instruction asked for unsupported content);
  // `rationale` explains what changed so the user can judge the edit.
  rationale?: string;
  issue?: string;
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
  // Optional explainability payload. Persisted so the Optimize tab can rebuild
  // the "Why this score" panel from the original match after a page refresh.
  // Both optional → legacy cache entries parse unchanged.
  categoryScores?: CategoryScoresData | null;
  strategicRealityCheck?: StrategicRealityCheck | null;
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
  // Category scores from API. The matched/missing/gaps arrays already flow
  // through at runtime (from ai-match); typing them here makes that evidence
  // usable by the explainability panel without a data change.
  categoryScores?: {
    hard_skills?: { score: number; max: number; reasoning?: string; matched?: string[]; missing?: string[]; gaps?: string[] };
    experience?: { score: number; max: number; reasoning?: string; matched?: string[]; missing?: string[]; gaps?: string[] };
    education?: { score: number; max: number; reasoning?: string; matched?: string[]; missing?: string[]; gaps?: string[] };
    soft_skills?: { score: number; max: number; reasoning?: string; matched?: string[]; missing?: string[]; gaps?: string[] };
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
  // Position name suggestion from AI
  positionSuggestion?: {
    original: string;          // joined display string e.g. "Data Analyst / Sales Specialist"
    suggested: string;         // representative suggested title for display in banner
    reason: string;
    is_necessary: boolean;
    applied?: boolean;
    originalPositions?: string[];  // stored on apply for revert
    positionChanges?: Array<{      // per-position granular mapping
      original: string;
      suggested: string;
      change_needed: boolean;
    }>;
  } | null;
}

/**
 * Snapshot of the working optimization set captured when a job variant is saved.
 * A variant never copies the base resume (originalResume stays canonical) — it only
 * holds the job-scoped, user-gated optimization cards + view state, replayed over the
 * shared base on open. See docs/adr/ADR-job-specific-resume-builder.md.
 */
export interface JobVariantSnapshot {
  optimizations: OptimizationResult[];
  keywordSuggestions: KeywordSuggestion[];
  optimizationMetrics: OptimizationMetrics;
  baselineMatchScore: number | null;
  selectedTemplate: TemplateId;
}

/**
 * A resume variant tuned for one job description. Phase 1: local-only, one active at
 * a time. The base resume is shared/immutable; the variant carries job context plus
 * its own applied-cards snapshot.
 */
export interface JobVariant {
  id: string;
  label: string;
  jobTitle?: string;
  /** Stored truncated for retention hygiene (see ADR §5). */
  jobDescription: string;
  createdAt: string;
  updatedAt: string;
  snapshot: JobVariantSnapshot;
}

/**
 * Display options for template rendering (user-adjustable)
 */
export interface DisplayOptions {
  fontSize: number; // Legacy scale factor: 1 = 100%, 0.9 = 90%, 1.1 = 110%
  // Font formatting
  baseFontSize: number;   // pt (9-12)
  headingSize: number;    // pt (12-18)
  nameSize?: number;      // pt (16-28), defaults to 20
  fontFamily: string;     // CSS font-family
  // Document formatting
  sectionSpacing: number; // px (4-20)
  paragraphSpacing: number; // px (2-12)
  lineHeight: number;     // ratio (1.2-2.0)
  marginTop: number;      // inches (0.3-1.0)
  marginBottom: number;   // inches (0.3-1.0)
  marginSide: number;     // inches (0.3-1.0)
  // Page break indicators
  showPageBreaks: boolean;
  // Keyword bolding (DOCX exports)
  boldKeywords: boolean;  // Bold important keywords from job description (default: true)
}

/**
 * Resume content language (detected from resume text)
 */
export type ContentLanguage = 'en' | 'ar' | 'mixed' | null;

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

  // Baseline match score (original resume's score before any optimizations)
  baselineMatchScore: number | null;

  // Saudi nationality flag for Saudization ATS
  isSaudiNational: boolean;

  // Onboarding: job-search intent (target role / comp / location). The one new
  // canonical-profile slice — everything else onboarding produces lives on the resume.
  searchIntent: SearchIntent | null;

  // Job-specific resume variants (Phase 1: local-only, single active at a time).
  jobVariants: JobVariant[];
  activeVariantId: string | null;
  // Ephemeral (not persisted) signal — bumped only by openVariant so views can
  // reset per-run UI state (e.g. verified score) when a variant is REOPENED,
  // without also firing when the current run is saved as a new variant.
  variantRestoreNonce: number;

  // View state
  showOptimized: boolean;
  selectedTemplate: TemplateId;
  displayOptions: DisplayOptions;
  hasDownloaded: boolean;
  contentLanguage: ContentLanguage;

  // Actions
  setOriginalResume: (resume: ResumeSchema) => void;
  addOptimization: (optimization: Omit<OptimizationResult, 'timestamp'>) => void;
  applyOptimization: (id: string) => void;
  revertOptimization: (id: string) => void;
  refineOptimization: (id: string, refinement: { improved: string; issue?: string; rationale?: string; instruction: string }) => void;
  setParsedResumeText: (text: unknown) => void;
  setOptimizations: (opts: OptimizationResult[]) => void;
  applyAllOptimizations: () => void;
  revertAllOptimizations: () => void;
  toggleShowOptimized: () => void;
  setShowOptimized: (_show: boolean) => void;
  setSelectedTemplate: (_id: TemplateId) => void;
  setKeywordSuggestions: (_suggestions: KeywordSuggestion[]) => void;
  setHasDownloaded: (value: boolean) => void;
  getActiveResume: () => ResumeSchema | null;
  clearAll: () => void;
  resetForNewUpload: () => void;

  // Optimization metrics actions
  setOptimizationMetrics: (metrics: Partial<OptimizationMetrics>) => void;
  resetOptimizationMetrics: () => void;

  // Cache actions
  getCachedAnalysis: (resumeText: string, jobDescription: string, forceIsOptimized?: boolean) => CachedAnalysis | null;
  setCachedAnalysis: (resumeText: string, jobDescription: string, analysis: Omit<CachedAnalysis, 'timestamp'>, forceIsOptimized?: boolean) => void;
  clearAnalysisCache: () => void;

  // Display options actions
  setDisplayOptions: (options: Partial<DisplayOptions>) => void;
  togglePageBreaks: () => void;

  // Language detection
  setContentLanguage: (lang: ContentLanguage) => void;

  // Baseline score tracking
  setBaselineMatchScore: (score: number) => void;

  // Saudi nationality
  setSaudiNational: (value: boolean) => void;

  // Onboarding actions
  /** Replace the job-search intent slice (stamps meta.updatedAt + completeness). */
  setSearchIntent: (intent: SearchIntent | null) => void;
  /**
   * Single onboarding writer: fuzzy-merge a partial resume patch into originalResume,
   * deduping array entries and recording provenance in meta.ai_suggestions. All
   * onboarding resume writes go through here — never write originalResume directly.
   */
  patchProfile: (patch: PartialResumeSchema) => void;
  /** 0-100 profile completeness across resume + searchIntent (item-2 foundation). */
  getProfileCompleteness: () => number;

  // Job variant actions (Phase 1). Snapshot/restore over the shared base resume —
  // saving/opening a variant never mutates originalResume.
  /** Snapshot the current working set as a new variant; returns its id and makes it active. */
  saveCurrentAsVariant: (label: string, jobDescription: string, jobTitle?: string) => string;
  /** Re-snapshot the current working set into an existing variant (bumps updatedAt). */
  updateVariant: (id: string, jobDescription: string) => void;
  /** Restore a variant's snapshot into the working set; returns the variant (for JD restore) or null. */
  openVariant: (id: string) => JobVariant | null;
  /** Rename a variant (label only). */
  renameVariant: (id: string, label: string) => void;
  /** Delete a variant; clears activeVariantId if it was the active one. */
  deleteVariant: (id: string) => void;
}

/**
 * Template component props
 */
export interface TemplateProps {
  resume: ResumeSchema;
  isAtsMode?: boolean;
  scale?: number;
  displayOptions?: DisplayOptions;
  /** @deprecated Use displayOptions.fontSize instead */
  fontScale?: number;
}

/**
 * PDF export options
 */
export interface PdfExportOptions {
  format: 'styled' | 'ats';
  templateHtml?: string;
  fileName?: string;
}




