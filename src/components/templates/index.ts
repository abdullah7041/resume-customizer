// Template System Exports
// Re-export all template components, utilities, and types

// Templates
export { ModernProfessional } from './ModernProfessional';
export { ClassicTraditional } from './ClassicTraditional';
export { TechnicalEngineer } from './TechnicalEngineer';
export { ATSOptimized } from './ATSOptimized';

// Registry
export {
  TEMPLATES,
  TEMPLATE_CONFIGS,
  getTemplate,
  getTemplateConfig,
  getTemplatesByCategory,
} from './registry';

// Template types
export type { TemplateProps, TemplateComponent } from './BaseTemplate';
