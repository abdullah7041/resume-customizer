// Template system types - extends JSON Resume schema
import type { ResumeSchema } from './resume';

/**
 * Available template identifiers
 */
export type TemplateId =
  | 'modern-professional'
  | 'classic-traditional'
  | 'technical-minimal'
  | 'executive-bold';

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
  sectionType: 'summary' | 'experience' | 'skills' | 'projects' | 'headline' | 'education';
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
  coverage: number;
  similarity: number;
  missingKeywords: string[];
  strongMatches: string[];
  recommendations: string[];
  overallAssessment: string;
  timestamp: number;
}

/**
 * Analysis cache keyed by fingerprint
 */
export interface AnalysisCache {
  [key: string]: CachedAnalysis;
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




