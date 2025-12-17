import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { TEMPLATE_CONFIGS, TEMPLATES } from './registry';
import type { TemplateId, TemplateCategory } from '../../types/templates';
import type { ResumeSchema } from '../../types/resume';

// Icons (inline SVG to avoid dependency)
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

/**
 * Sample resume data for template previews
 */
const SAMPLE_RESUME: ResumeSchema = {
  basics: {
    name: 'Your Name',
    label: 'Your Title',
    email: 'email@example.com',
    phone: '+966 5X XXX XXXX',
    summary: 'Professional summary preview text that demonstrates how your content will appear...',
    location: {
      city: 'Riyadh',
      region: 'Riyadh',
      countryCode: 'SA',
    },
    profiles: [],
  },
  work: [
    {
      name: 'Company Name',
      position: 'Job Title',
      startDate: '2020',
      endDate: 'Present',
      summary: '',
      highlights: ['Key achievement one', 'Key achievement two'],
    },
  ],
  education: [
    {
      institution: 'University Name',
      area: 'Field of Study',
      studyType: 'Degree',
      startDate: '2016',
      endDate: '2020',
    },
  ],
  skills: [
    { name: 'Skills', keywords: ['Skill 1', 'Skill 2', 'Skill 3'] },
  ],
};

interface TemplateSelectorProps {
  onSelect?: (id: TemplateId) => void;
}

type CategoryFilter = TemplateCategory | 'all';

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const {
    selectedTemplate,
    setSelectedTemplate,
    showOptimized,
    toggleShowOptimized,
    optimizations,
    getActiveResume,
    originalResume,
  } = useResumeStore();

  // Use actual user resume if available, otherwise fall back to sample data
  const activeResume = getActiveResume();
  const displayResume = activeResume || originalResume || SAMPLE_RESUME;

  const [category, setCategory] = useState<CategoryFilter>('all');

  const filteredTemplates = useMemo(
    () =>
      category === 'all'
        ? TEMPLATE_CONFIGS
        : TEMPLATE_CONFIGS.filter((t) => t.category === category),
    [category]
  );

  const hasOptimizations = optimizations.length > 0;

  const handleSelect = (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    onSelect?.(templateId);
  };

  const categories: { value: CategoryFilter; labelEn: string; labelAr: string }[] = [
    { value: 'all', labelEn: 'All', labelAr: 'الكل' },
    { value: 'modern', labelEn: 'Modern', labelAr: 'عصري' },
    { value: 'classic', labelEn: 'Classic', labelAr: 'كلاسيكي' },
    { value: 'technical', labelEn: 'Technical', labelAr: 'تقني' },
  ];

  return (
    <div className="space-y-6">
      {/* Optimized Toggle */}
      {hasOptimizations && (
        <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            {showOptimized ? (
              <span className="text-emerald-400">
                <EyeIcon />
              </span>
            ) : (
              <span className="text-gray-400">
                <EyeOffIcon />
              </span>
            )}
            <div>
              <p className="font-medium text-white">
                {showOptimized
                  ? isArabic
                    ? 'عرض المحسّن'
                    : 'Showing Optimized'
                  : isArabic
                    ? 'عرض الأصلي'
                    : 'Showing Original'}
              </p>
              <p className="text-sm text-gray-400">
                {showOptimized
                  ? isArabic
                    ? 'التغييرات المطبقة مرئية'
                    : 'Applied changes are visible'
                  : isArabic
                    ? 'إصدار السيرة الذاتية الأصلي'
                    : 'Original resume version'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleShowOptimized}
            className={`relative w-14 h-7 rounded-full transition-colors ${showOptimized ? 'bg-emerald-600' : 'bg-gray-600'
              }`}
            aria-label={showOptimized ? 'Show original' : 'Show optimized'}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${showOptimized ? 'start-8' : 'start-1'
                }`}
            />
          </button>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${category === cat.value
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            {isArabic ? cat.labelAr : cat.labelEn}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredTemplates.map((config) => {
          const Template = TEMPLATES[config.id];
          const isSelected = selectedTemplate === config.id;

          return (
            <button
              key={config.id}
              onClick={() => handleSelect(config.id)}
              className={`relative group rounded-xl overflow-hidden border-2 transition-all text-start ${isSelected
                ? 'border-emerald-500 ring-2 ring-emerald-500/50'
                : 'border-gray-700 hover:border-gray-500'
                }`}
            >
              {/* Live Template Preview (scaled down) */}
              <div className="aspect-[210/297] bg-white overflow-hidden pointer-events-none">
                <div
                  className={isArabic ? "origin-top-right" : "origin-top-left"}
                  style={{
                    width: '210mm',
                    height: '297mm',
                    transform: 'scale(0.15)',
                    direction: isArabic ? 'rtl' : 'ltr',
                  }}
                >
                  <Template resume={displayResume} scale={1} />
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 end-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  <CheckIcon />
                </div>
              )}

              {/* Label */}
              <div
                className="absolute bottom-0 inset-x-0 py-2 px-3 text-center text-sm font-medium text-white"
                style={{ backgroundColor: config.previewColor }}
              >
                {isArabic ? config.nameAr : config.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}




