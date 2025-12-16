import type { TemplateComponent } from './BaseTemplate';
import type { TemplateConfig, TemplateId } from '../../types/templates';
import { ModernProfessional } from './ModernProfessional';
import { ClassicTraditional } from './ClassicTraditional';

/**
 * Template component registry
 * Maps template IDs to their React components
 */
export const TEMPLATES: Record<TemplateId, TemplateComponent> = {
  'modern-professional': ModernProfessional as TemplateComponent,
  'classic-traditional': ClassicTraditional as TemplateComponent,
  'technical-minimal': ModernProfessional as TemplateComponent, // TODO: Create dedicated template
  'executive-bold': ClassicTraditional as TemplateComponent, // TODO: Create dedicated template
};

/**
 * Template configuration metadata
 * Used for template selector UI and filtering
 */
export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    id: 'modern-professional',
    name: 'Modern Professional',
    nameAr: 'احترافي عصري',
    category: 'modern',
    description: 'Clean, contemporary design with accent colors',
    descriptionAr: 'تصميم عصري ونظيف مع ألوان مميزة',
    isAtsOptimized: true,
    previewColor: '#10b981', // emerald-500
  },
  {
    id: 'classic-traditional',
    name: 'Classic Traditional',
    nameAr: 'كلاسيكي تقليدي',
    category: 'classic',
    description: 'Timeless two-column layout with elegant typography',
    descriptionAr: 'تخطيط كلاسيكي بعمودين مع طباعة أنيقة',
    isAtsOptimized: true,
    previewColor: '#6b7280', // gray-500
  },
  {
    id: 'technical-minimal',
    name: 'Technical Minimal',
    nameAr: 'تقني بسيط',
    category: 'technical',
    description: 'Stripped-down format for technical roles',
    descriptionAr: 'تنسيق مبسط للأدوار التقنية',
    isAtsOptimized: true,
    previewColor: '#3b82f6', // blue-500
  },
  {
    id: 'executive-bold',
    name: 'Executive Bold',
    nameAr: 'تنفيذي جريء',
    category: 'classic',
    description: 'Commanding presence for senior positions',
    descriptionAr: 'حضور قوي للمناصب القيادية',
    isAtsOptimized: true,
    previewColor: '#1f2937', // gray-800
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
