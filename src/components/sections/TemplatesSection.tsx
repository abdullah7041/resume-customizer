// src/components/sections/TemplatesSection.tsx
// Resume template gallery with resume.io style split-panel layout

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { Download, ToggleLeft, ToggleRight, Check, Layers, Sparkles, FileText, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES } from "../../lib/data/resumeTemplates";
import { useResumeStore } from "../../lib/stores/resumeStore";
import { analytics } from "../../services/analytics";

import TemplateRenderer from "../templates/TemplateRenderer";
// ResumePDFDocument is now loaded dynamically when needed
import Button from "../ui/Button";
import { mergeResumeData } from "../../lib/utils/resumeUtils";
import { cn } from "../../lib/utils/cn";
import type { ResumeSchema } from "../../types/resume";

// Glass card styles matching Header.jsx
const glassCardClass =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)]";

const categoryLabels = {
  [TEMPLATE_CATEGORIES.MODERN]: "Modern",
  [TEMPLATE_CATEGORIES.CLASSIC]: "Classic",
  [TEMPLATE_CATEGORIES.TECHNICAL]: "Technical"
  // Removed Creative and Executive per user request
};

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

// Template thumbnail card with miniature preview
interface TemplateThumbnailProps {
  template: typeof resumeTemplates[0];
  isSelected: boolean;
  onClick: () => void;
  resumeData: ResumeSchema | Partial<ResumeSchema> | null;
  isArabic?: boolean;
}

const TemplateThumbnail = ({ template, isSelected, onClick, resumeData, isArabic = false }: TemplateThumbnailProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full aspect-[3/4] rounded-xl border-2 transition-all duration-300 overflow-hidden group",
        isSelected
          ? "border-emerald-400/50 ring-2 ring-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          : "border-white/10 hover:border-emerald-400/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
      )}
    >
      {/* Miniature Preview */}
      <div className="absolute inset-0 bg-white overflow-hidden">
        <div
          className={`${isArabic ? 'origin-top-right' : 'origin-top-left'} pointer-events-none select-none`}
          style={{
            transform: 'scale(0.22)',
            transformOrigin: isArabic ? 'top right' : 'top left',
            width: '454%',
            height: '454%',
            direction: isArabic ? 'rtl' : 'ltr',
          }}
        >
          <TemplateRenderer template={template} userData={(resumeData || {}) as any} />
        </div>
      </div>

      {/* Selected Checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Template Name Overlay */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 p-2.5 transition-all z-10",
        isSelected
          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
          : "bg-gradient-to-t from-black/90 via-black/60 to-transparent"
      )}>
        <p className="text-xs font-medium text-white truncate text-center">
          {template.name}
        </p>
      </div>
    </button>
  );
};

interface TemplateGalleryProps {
  resumeData?: ResumeSchema | null;
  optimizationData?: unknown;
  onSelectTemplate?: (template: typeof resumeTemplates[0]) => void;
}

export default function TemplateGallery({ resumeData: propResumeData, optimizationData, onSelectTemplate }: TemplateGalleryProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(resumeTemplates[0]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Get resume data from store
  const {
    originalResume: storeOriginalResume,
    showOptimized,
    toggleShowOptimized,
    getActiveResume,
    setSelectedTemplate: setStoreTemplate,
  } = useResumeStore();

  // Use prop data or store data
  const hasPropsData = Boolean(propResumeData);
  const storeActiveResume = getActiveResume();

  // Determine which resume to use - check originalResume directly since 
  // getActiveResume might return null in edge cases
  const resumeData = hasPropsData ? propResumeData : (storeActiveResume || storeOriginalResume);
  const hasRealResume = Boolean(resumeData);

  // Download PDF using @react-pdf/renderer (loaded dynamically to reduce initial bundle)
  const handleDownloadPdf = async () => {
    if (isDownloading) return;

    if (!hasRealResume) {
      console.warn('Cannot download PDF: No resume data available');
      return;
    }

    setIsDownloading(true);

    const filename = `resume-${selectedTemplate.id}-${new Date().toISOString().split('T')[0]}.pdf`;

    try {
      // Dynamic imports to avoid loading ~1.5MB PDF library until needed
      const [{ pdf }, { default: ResumePDFDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../templates/ResumePDFDocument")
      ]);

      const blob = await pdf(<ResumePDFDocument userData={mergedDownloadData} />).toBlob();
      saveAs(blob, filename);

      // Track PDF export
      analytics.trackExport(selectedTemplate.id, 'pdf');
    } catch (err) {
      console.error("PDF Download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Filter templates - exclude Creative and Executive categories
  const filteredTemplates = useMemo(() => {
    const allowedCategories = [TEMPLATE_CATEGORIES.MODERN, TEMPLATE_CATEGORIES.CLASSIC, TEMPLATE_CATEGORIES.TECHNICAL];
    const baseTemplates = resumeTemplates.filter(t => allowedCategories.includes(t.category));

    if (selectedCategory === "all") {
      return baseTemplates;
    }
    return baseTemplates.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  // Merged data for display - use store active resume or props
  const displayData = useMemo(() => {
    if (hasPropsData) {
      // Using props - apply mergeResumeData for backwards compatibility
      const original = propResumeData || {};
      const merged = mergeResumeData(propResumeData, { optimization: optimizationData });

      if (showOptimized && merged) {
        return merged;
      }
      return original;
    }

    // Using store - prefer activeResume, then originalResume, then sample
    return storeActiveResume || storeOriginalResume || SAMPLE_RESUME;
  }, [hasPropsData, propResumeData, optimizationData, showOptimized, storeActiveResume, storeOriginalResume]);

  // Data for PDF download (always use merged)
  const mergedDownloadData = useMemo(() => {
    if (hasPropsData) {
      if (!propResumeData) return {};
      const merged = mergeResumeData(propResumeData, { optimization: optimizationData });
      return merged || propResumeData;
    }

    // Use store's active resume or original
    return storeActiveResume || storeOriginalResume || {};
  }, [hasPropsData, propResumeData, optimizationData, storeActiveResume, storeOriginalResume]);

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
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 min-h-[600px] md:min-h-[600px] p-2">
      {/* Left Panel - Template Selection (responsive) */}
      <div className={cn(glassCardClass, "w-full md:w-[340px] flex-shrink-0 flex flex-col")}>
        {/* Header with Toggle */}
        <div className="p-4 md:p-5 space-y-4 border-b border-white/10">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Templates</h2>
          </div>

          {/* Original/Optimized Toggle */}
          <button
            onClick={toggleShowOptimized}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border",
              showOptimized
                ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border-emerald-400/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
            )}
            title="Toggle between original and optimized versions"
          >
            {showOptimized ? (
              <>
                <ToggleRight className="w-5 h-5 text-emerald-400" />
                <span>Showing Optimized</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5" />
                <span>Showing Original</span>
              </>
            )}
          </button>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                selectedCategory === "all"
                  ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              )}
            >
              All
            </button>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                  selectedCategory === value
                    ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid - horizontal scroll on mobile, grid on desktop */}
        <div className="flex-1 overflow-hidden p-4">
          {/* Mobile: Horizontal scroll carousel */}
          <div className="flex md:hidden overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scroll-smooth -mx-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filteredTemplates.map(template => (
              <div key={template.id} className="flex-shrink-0 w-[140px] snap-center">
                <TemplateThumbnail
                  template={template}
                  isSelected={selectedTemplate?.id === template.id}
                  onClick={() => handleSelectTemplate(template)}
                  resumeData={displayData}
                  isArabic={isArabic}
                />
              </div>
            ))}
          </div>
          {/* Mobile swipe hint */}
          <div className="flex md:hidden items-center justify-center gap-1 mt-3 text-xs text-white/40">
            <ChevronLeft className="w-4 h-4" />
            <span>Swipe to browse</span>
            <ChevronRight className="w-4 h-4" />
          </div>

          {/* Desktop: Grid layout */}
          <div className="hidden md:grid grid-cols-2 gap-3">
            {filteredTemplates.map(template => (
              <TemplateThumbnail
                key={template.id}
                template={template}
                isSelected={selectedTemplate?.id === template.id}
                onClick={() => handleSelectTemplate(template)}
                resumeData={displayData}
                isArabic={isArabic}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className={cn(glassCardClass, "flex-1 flex flex-col min-h-[400px] md:min-h-0")}>
        {/* Preview Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 md:p-5 border-b border-white/10">
          <div>
            <h3 className="text-base md:text-lg font-bold text-white">
              {selectedTemplate?.name}
            </h3>
            <p className="text-xs sm:text-sm text-white/60 flex items-center gap-1.5 mt-1">
              {showOptimized ? (
                <><Sparkles className="w-4 h-4 text-emerald-400" /> Optimized Version</>
              ) : (
                <><FileText className="w-4 h-4 text-white/40" /> Original Version</>
              )}
              {selectedTemplate && <span className="ml-1">• {categoryLabels[selectedTemplate.category as keyof typeof categoryLabels]}</span>}
            </p>
          </div>

          <Button
            onClick={handleDownloadPdf}
            variant="primary"
            disabled={!hasRealResume || isDownloading}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 shadow-[0_0_20px_rgba(16,185,129,0.3)] px-4 py-2 text-sm min-h-[44px]"
          >
            {isDownloading ? "Generating..." : <><Download className="w-4 h-4 mr-2" />Download PDF</>}
          </Button>
        </div>

        {/* No Resume Warning */}
        {!hasRealResume && (
          <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-400">
              This is a preview. Upload your resume to see your data.
            </p>
          </div>
        )}

        {/* Live Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-900/50 to-gray-800/30">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] rounded-xl overflow-hidden ring-1 ring-white/10">
              {selectedTemplate && (
                <TemplateRenderer
                  template={selectedTemplate}
                  userData={displayData}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
