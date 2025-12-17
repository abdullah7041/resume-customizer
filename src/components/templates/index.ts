// Template System Exports
// Re-export all template components, utilities, and types

// Templates
export { ModernProfessional } from './ModernProfessional';
export { ClassicTraditional } from './ClassicTraditional';

// Base components and utilities
export { ATSResume, A4_STYLES, ATS_STYLES, safeString, formatContactLine } from './BaseTemplate';
export type { TemplateProps, TemplateComponent } from './BaseTemplate';

// Registry
export {
  TEMPLATES,
  TEMPLATE_CONFIGS,
  getTemplate,
  getTemplateConfig,
  getTemplatesByCategory,
} from './registry';

// UI Components
export { TemplateSelector } from './TemplateSelector';
export { ResumePreview } from './ResumePreview';




