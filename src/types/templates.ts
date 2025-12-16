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
  sectionType: 'summary' | 'experience' | 'skills' | 'projects';
  original: string | string[];
  optimized: string | string[];
  applied: boolean;
  timestamp: string;
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
 * Resume state for the store
 */
export interface ResumeState {
  // Core data
  originalResume: ResumeSchema | null;
  optimizations: OptimizationResult[];

  // View state
  showOptimized: boolean;
  selectedTemplate: TemplateId;

  // Actions
  setOriginalResume: (resume: ResumeSchema) => void;
  addOptimization: (optimization: Omit<OptimizationResult, 'timestamp'>) => void;
  applyOptimization: (sectionId: string) => void;
  revertOptimization: (sectionId: string) => void;
  applyAllOptimizations: () => void;
  toggleShowOptimized: () => void;
  setSelectedTemplate: (templateId: TemplateId) => void;
  getActiveResume: () => ResumeSchema | null;
  clearAll: () => void;
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



