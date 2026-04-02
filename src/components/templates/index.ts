// Template System Exports
// Re-export all template components, utilities, and types

// Templates
export { ModernProfessional } from './ModernProfessional';
export { TechnicalEngineer } from './TechnicalEngineer';
export { ATSOptimized } from './ATSOptimized';
export { ExecutiveProfessional } from './ExecutiveProfessional';

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
