// Template system types - extends JSON Resume schema
import type { ResumeSchema } from './resume';

/**
 * Available template identifiers
 */
export type TemplateId =
  | 'modern-professional'
  | 'classic-traditional'
  | 'technical-engineer';

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




