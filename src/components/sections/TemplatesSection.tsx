// src/components/sections/TemplatesSection.tsx
// Resume template gallery with floating overlay template selector

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { Download, Check, Sparkles, AlertCircle, Edit3 } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES } from "../../lib/data/resumeTemplates";
import { useResumeStore } from "../../lib/stores/resumeStore";
import { analytics } from "../../services/analytics";

import TemplateRenderer from "../templates/TemplateRenderer";
import { GlassButton } from "../ui/GlassButton";
import { LoadingMessages } from "../LoadingMessages";
import { ManualDataEditor } from "../ui/ManualDataEditor";

import { cn } from "../../lib/utils/cn";
import type { ResumeSchema } from "../../types/resume";

// Fallback sample data - ONLY used when no resume is uploaded
const SAMPLE_RESUME: Partial<ResumeSchema> = {
  basics: {
    name: 'Your Name',
    label: 'Your Job Title',
    email: 'email@example.com',
    phone: '+966 5X XXX XXXX',
    summary: 'Upload your resume to see your professional summary here.',
    location: {
      city: 'Riyadh',
      countryCode: 'SA',
      region: 'Riyadh',
    },
    profiles: [],
  },
  work: [
    {
      name: 'Company Name',
      position: 'Job Title',
      startDate: '2020',
      endDate: '',
      summary: '',
      highlights: ['Upload your resume to see your experience here.'],
    },
  ],
  education: [
    {
      institution: 'University Name',
      area: 'Field of Study',
      studyType: 'Degree Name',
      startDate: '2016',
      endDate: '2020',
    },
  ],
  skills: [
    { name: 'Skills', keywords: ['Skill 1', 'Skill 2', 'Skill 3'] },
  ],
  languages: [{ language: 'English', fluency: 'Fluent' }],
};

interface TemplateGalleryProps {
  resumeData?: ResumeSchema | null;
  optimizationData?: unknown;
  onSelectTemplate?: (template: typeof resumeTemplates[0]) => void;
}

export default function TemplateGallery({ resumeData: propResumeData, optimizationData, onSelectTemplate }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState(resumeTemplates[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isHoveringSelector, setIsHoveringSelector] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Get resume data from store - subscribe to all relevant state for reactivity
  const {
    originalResume: storeOriginalResume,
    optimizations,  // Subscribe to optimizations - triggers re-render when optimizations change
    showOptimized,
    getActiveResume,
    setSelectedTemplate: setStoreTemplate,
  } = useResumeStore();

  // Determine if store has applied optimizations - THIS TAKES PRIORITY
  const hasAppliedOptimizations = optimizations.some(o => o.applied);

  // Use store data when:
  // 1. Store has applied optimizations (user clicked Apply All)
  // 2. OR when showOptimized is true
  // Use prop data only as fallback when store is empty
  const useStoreData = hasAppliedOptimizations || showOptimized || !propResumeData;

  // Compute active resume reactively
  // Note: optimizations and showOptimized are intentionally included to trigger re-computation
  const storeActiveResume = useMemo(() => {
    if (!useStoreData) return null;
    return getActiveResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optimizations & showOptimized trigger re-render when store changes
  }, [getActiveResume, showOptimized, optimizations, useStoreData]);

  // Determine which resume to use
  const resumeData = useStoreData
    ? (storeActiveResume || storeOriginalResume)
    : propResumeData;
  const hasRealResume = Boolean(resumeData?.basics?.name);

  // Filter to only active templates (Modern, Classic, Technical)
  const activeTemplates = useMemo(() => {
    const allowedCategories = [TEMPLATE_CATEGORIES.MODERN, TEMPLATE_CATEGORIES.CLASSIC, TEMPLATE_CATEGORIES.TECHNICAL];
    return resumeTemplates.filter(t => allowedCategories.includes(t.category));
  }, []);

  // Merged data for display - reactive to all state changes
  const displayData = useMemo((): Partial<ResumeSchema> => {
    return useStoreData
      ? (storeActiveResume || storeOriginalResume || SAMPLE_RESUME)
      : (propResumeData || SAMPLE_RESUME);
  }, [useStoreData, storeActiveResume, storeOriginalResume, propResumeData]);

  // Download PDF using server-side Puppeteer (Netlify function)
  // Note: We now send pre-rendered HTML from the preview instead of resumeData
  const handleDownloadPdf = async () => {
    if (isDownloading) return;

    if (!hasRealResume) {
      console.warn('Cannot download PDF: No resume data available');
      return;
    }

    setIsDownloading(true);

    const filename = `resume-${selectedTemplate.id}-${new Date().toISOString().split('T')[0]}.pdf`;

    try {
      // Capture rendered HTML from preview container
      const previewElement = document.querySelector('[data-resume-preview]');
      if (!previewElement) {
        throw new Error('Preview not found - unable to capture HTML');
      }

      // Get fully rendered HTML including computed styles
      const html = previewElement.outerHTML;

      const response = await fetch('/.netlify/functions/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          templateId: selectedTemplate.id,
        }),
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await response.blob();
      saveAs(blob, filename);

      // Track PDF export
      analytics.trackExport(selectedTemplate.id, 'pdf');
    } catch (err) {
      console.error("PDF Download failed:", err);
      // TODO: Show user-facing error toast
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSelectTemplate = (template: typeof resumeTemplates[0]) => {
    setSelectedTemplate(template);
    setStoreTemplate(template.id as any);

    // Track template selection
    analytics.trackTemplateSelected(template.id);

    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
  };

  return (
    <div className="relative flex flex-col min-h-[700px] md:min-h-[800px]">
      {/* Full-Width Preview */}
      <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden min-h-0">

        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">{selectedTemplate.name}</h3>
            <p className="text-sm text-white/60 flex items-center gap-1.5 mt-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              {t(`sections.templates.categories.${selectedTemplate.category.toLowerCase()}`)}
            </p>
          </div>

          <div className="flex gap-3">
            <GlassButton
              onClick={() => setIsEditorOpen(true)}
              variant="secondary"
              disabled={!hasRealResume}
              className="border border-white/20"
            >
              <Edit3 className="w-4 h-4 me-2" />
              {t('sections.templates.editData', 'Edit Data')}
            </GlassButton>

            <GlassButton
              onClick={handleDownloadPdf}
              variant="primary"
              disabled={!hasRealResume || isDownloading}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 shadow-lg"
            >
              {isDownloading ? t('sections.templates.generating', 'Generating...') : (
                <><Download className="w-4 h-4 me-2" />{t('sections.templates.downloadPdf', 'Download PDF')}</>
              )}
            </GlassButton>
          </div>
        </div>

        {/* No Resume Warning */}
        {!hasRealResume && (
          <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-400">
              {t('sections.templates.noResumeWarning', 'This is a preview. Upload your resume to see your data.')}
            </p>
          </div>
        )}

        {/* Preview Area with Floating Selector */}
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 bg-gradient-to-br from-gray-900/50 to-gray-800/30 min-h-0">

          {/* Resume Preview */}
          <div className="w-full flex justify-center pb-28 md:pb-20">
            <div
              dir="ltr"
              className="bg-white shadow-2xl rounded-xl overflow-hidden ring-1 ring-white/10 w-full max-w-[210mm] transition-all duration-500"
            >
              <TemplateRenderer
                template={selectedTemplate}
                userData={displayData as unknown as Record<string, unknown>}
              />
            </div>
          </div>

          {/* Floating Template Selector - Sticky at bottom of scroll container */}
          <div
            className={cn(
              "sticky bottom-4 md:bottom-4 inset-x-0 z-50 w-fit mx-auto",
              "transition-all duration-300 ease-out",
              isHoveringSelector ? "opacity-100 scale-100" : "opacity-60 md:opacity-40 scale-100 md:scale-95 hover:opacity-100 hover:scale-100"
            )}
            onMouseEnter={() => setIsHoveringSelector(true)}
            onMouseLeave={() => setIsHoveringSelector(false)}
          >
            {/* Desktop Pills */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
              {activeTemplates.map((template) => {
                const isSelected = selectedTemplate.id === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200",
                      isSelected
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {isSelected && (
                      <Check className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium whitespace-nowrap">
                      {template.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Chips - Simplified and compact */}
            <div className="md:hidden flex items-center justify-center gap-1.5 px-2 py-1.5 bg-black/90 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
              {activeTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200",
                    selectedTemplate.id === template.id
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                      : "text-white/60 active:bg-white/10"
                  )}
                >
                  {selectedTemplate.id === template.id && <Check className="w-3 h-3" />}
                  {template.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Subtle hint text - desktop only */}
            <p className={cn(
              "hidden md:block text-center text-xs text-white/40 mt-2 transition-opacity",
              isHoveringSelector ? "opacity-100" : "opacity-0"
            )}>
              {t('sections.templates.selectHint', 'Choose your style')}
            </p>
          </div>
        </div>

        {/* PDF Generation Loading Overlay */}
        {isDownloading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
              <LoadingMessages type="pdf" estimatedTime={10000} />
            </div>
          </div>
        )}
      </div>

      {/* Manual Data Editor Modal */}
      <ManualDataEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  );
}
