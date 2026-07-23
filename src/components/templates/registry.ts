import type { TemplateComponent } from './BaseTemplate';
import type { TemplateConfig, TemplateId } from '../../types/templates';
import { ModernProfessional } from './ModernProfessional';

import { TechnicalEngineer } from './TechnicalEngineer';
import { ATSOptimized } from './ATSOptimized';
import { ExecutiveProfessional } from './ExecutiveProfessional';

/**
 * Template component registry
 * Maps template IDs to their React components
 */
export const TEMPLATES: Record<TemplateId, TemplateComponent> = {
  'modern-professional': ModernProfessional as TemplateComponent,

  'technical-engineer': TechnicalEngineer as TemplateComponent,
  'ats-optimized': ATSOptimized as TemplateComponent,
  'executive-professional': ExecutiveProfessional as TemplateComponent,
};

/**
 * Template configuration metadata
 * Used for template selector UI and filtering
 */
export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    id: 'modern-professional',
    name: 'Riyadh',
    nameAr: 'الرياض',
    category: 'modern',
    description: 'Clean & minimal, perfect for any industry',
    descriptionAr: 'تصميم عصري ونظيف مع ألوان مميزة',
    isAtsOptimized: true,
    previewColor: '#10b981', // emerald-500
  },

  {
    id: 'technical-engineer',
    name: 'Khobar',
    nameAr: 'الخبر',
    category: 'technical',
    description: 'Skills-first layout for technical roles',
    descriptionAr: 'تخطيط يركز على المهارات للأدوار التقنية',
    isAtsOptimized: true,
    previewColor: '#3b82f6', // Unused template-identity metadata; intentionally stays blue.
  },
  {
    id: 'ats-optimized',
    name: 'Qiddiya',
    nameAr: 'القدية',
    category: 'modern',
    description: 'Single-column layout optimized for Applicant Tracking Systems',
    descriptionAr: 'تنسيق عمود واحد محسّن لأنظمة تتبع المتقدمين',
    isAtsOptimized: true,
    previewColor: '#059669', // emerald-600
  },
  {
    id: 'executive-professional',
    name: 'Neom',
    nameAr: 'نيوم',
    category: 'executive',
    description: 'Elegant serif design for senior leadership and executive roles',
    descriptionAr: 'تصميم أنيق بخطوط سيريف للمناصب القيادية والتنفيذية',
    isAtsOptimized: true,
    previewColor: '#1a4f7a',
  },
];

/**
 * Get template component by ID
 * Falls back to modern-professional if not found
 */
export function getTemplate(id: TemplateId): TemplateComponent {
  return TEMPLATES[id] || TEMPLATES['modern-professional'];
}

/**
 * Get template configuration by ID
 * Falls back to first config if not found
 */
export function getTemplateConfig(id: TemplateId): TemplateConfig {
  return TEMPLATE_CONFIGS.find((t) => t.id === id) || TEMPLATE_CONFIGS[0];
}

/**
 * Filter templates by category
 */
export function getTemplatesByCategory(
  category: TemplateConfig['category'] | 'all'
): TemplateConfig[] {
  if (category === 'all') return TEMPLATE_CONFIGS;
  return TEMPLATE_CONFIGS.filter((t) => t.category === category);
}




