// src/components/sections/TemplatesSection.tsx
// Resume template gallery with floating overlay template selector

import { useState, useMemo, useLayoutEffect, useRef, useCallback, lazy, Suspense, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { Download, Check, Sparkles, AlertCircle, Edit3, ZoomIn, ZoomOut, RotateCcw, GripHorizontal, FileText, Info, ArrowLeftRight } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES } from "../../lib/data/resumeTemplates";
import { useResumeStore } from "../../lib/stores/resumeStore";
import { analytics } from "../../services/analytics";

import TemplateRenderer from "../templates/TemplateRenderer";
import { GlassButton } from "../ui/GlassButton";
import { GlassCard } from "../ui/GlassCard";
import { LoadingMessages } from "../LoadingMessages";
import { ManualDataEditor } from "../ui/ManualDataEditor";
import { FormattingPanel } from "../ui/FormattingPanel";
import { PageBreakOverlay, A4_PAGE_HEIGHT_PX } from "../ui/PageBreakIndicator";
import { useResumeLanguage } from "../../hooks/useResumeLanguage";

const ResumeDiffView = lazy(() => import("./ResumeDiffView"));

import { cn } from "../../lib/utils/cn";
import type { ResumeSchema } from "../../types/resume";
import type { TemplateId } from "../../types/templates";

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

/**
 * Generate a smart filename from resume data
 * Format: Name_Position.ext (e.g., Abdullah_Bin_Ahmed_Full-Stack.pdf)
 * Falls back to resume-template-date.ext
 */
function getSmartFilename(resume: Partial<ResumeSchema> | null, templateId: string, ext: string): string {
  if (!resume?.basics?.name) {
    const date = new Date().toISOString().split('T')[0];
    return `resume-${templateId}-${date}.${ext}`;
  }

  const name = resume.basics.name
    .trim()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '') // Keep alphanumeric, Arabic, spaces, hyphens
    .replace(/\s+/g, '_');

  let position = '';
  if (resume.basics.label) {
    // Take first segment before comma or slash
    position = resume.basics.label
      .split(/[,/]/)[0]
      .trim()
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  return position ? `${name}_${position}.${ext}` : `${name}_Resume.${ext}`;
}

interface TemplateGalleryProps {
  resumeData?: ResumeSchema | null;
  optimizationData?: unknown;
  onSelectTemplate?: (template: typeof resumeTemplates[0]) => void;
}

export default function TemplateGallery({ resumeData: propResumeData, optimizationData, onSelectTemplate }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState(resumeTemplates[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [isHoveringSelector, setIsHoveringSelector] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [isManuallyZoomed, setIsManuallyZoomed] = useState(false);

  // Draggable template bar state
  const [barPosition, setBarPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Get resume data from store - subscribe to all relevant state for reactivity
  const {
    originalResume: storeOriginalResume,
    optimizations,  // Subscribe to optimizations - triggers re-render when optimizations change
    showOptimized,
    // isSaudiNational is used by getActiveResume internally
    getActiveResume,
    setSelectedTemplate: setStoreTemplate,
    displayOptions,
  } = useResumeStore();

  // Detect resume content language
  const contentLanguage = useResumeLanguage();

  // Determine if store has applied optimizations - THIS TAKES PRIORITY
  const hasAppliedOptimizations = optimizations.some(o => o.applied);

  // Use store data when:
  // 1. Store has resume data (includes manual edits from ManualDataEditor)
  // 2. Store has applied optimizations
  // 3. showOptimized is true
  // Use prop data only as fallback when store is empty
  const useStoreData = Boolean(storeOriginalResume) || hasAppliedOptimizations || showOptimized || !propResumeData;

  // Compute active resume reactively
  // Fixed: Call getActiveResume() directly without memoizing on the function reference
  // The function itself is stable, but we need to recompute when the data it depends on changes
  const storeActiveResume = useMemo(() => {
    if (!useStoreData) return null;
    // getActiveResume() internally uses showOptimized, optimizations, isSaudiNational, originalResume
    // We rely on getActiveResume being a stable Zustand getter that internally handles reactivity
    return getActiveResume();
     
  }, [useStoreData, getActiveResume]);

  // Determine which resume to use
  const resumeData = useStoreData
    ? (storeActiveResume || storeOriginalResume)
    : propResumeData;
  const hasRealResume = Boolean(resumeData?.basics?.name);

  // Filter to only active templates (Modern, Classic, Technical)
  const activeTemplates = useMemo(() => {
    const allowedCategories = [TEMPLATE_CATEGORIES.MODERN, TEMPLATE_CATEGORIES.CLASSIC, TEMPLATE_CATEGORIES.TECHNICAL, TEMPLATE_CATEGORIES.EXECUTIVE];
    return resumeTemplates.filter(t => allowedCategories.includes(t.category));
  }, []);

  // Merged data for display - reactive to all state changes
  const displayData = useMemo((): Partial<ResumeSchema> => {
    const data = useStoreData
      ? (storeActiveResume || storeOriginalResume || SAMPLE_RESUME)
      : (propResumeData || SAMPLE_RESUME);

    // Debug logging only in development
    if (import.meta.env.DEV) {
      const appliedCount = optimizations.filter(o => o.applied).length;
      const isExportingOptimized = !!storeActiveResume && showOptimized && appliedCount > 0;

      // Dev verification intentionally removed
    }

    return data;
  }, [useStoreData, storeActiveResume, storeOriginalResume, propResumeData, showOptimized, optimizations]);

  // Calculate optimal initial scale based on viewport
  useLayoutEffect(() => {
    if (isManuallyZoomed) return;

    const handleResize = () => {
      const width = window.innerWidth;
      // A4 width in pixels at 96 DPI = 210mm * 96 / 25.4 ≈ 793px
      const a4WidthPx = 793;
      // Account for padding (p-3 = 12px on each side = 24px total)
      const availableWidth = width - 24;

      if (width < 640) { // Mobile
        // Account for outer card padding (p-4 = 16px * 2) + inner scroll container padding (p-3 = 12px * 2)
        const totalPadding = 16 * 2 + 12 * 2; // 56px
        const mobileAvailable = width - totalPadding;
        const mobileScale = mobileAvailable / a4WidthPx;
        setScale(Math.max(mobileScale, 0.35)); // Min 0.35 for very small screens
      } else if (width < 768) { // Tablet
        setScale(0.75);
      } else {
        setScale(0.9); // Desktop: 90% scale for "fit" look with margins
      }
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isManuallyZoomed]);


  // Zoom controls
  const handleZoomIn = () => {
    setIsManuallyZoomed(true);
    setScale(prev => Math.min(prev + 0.1, 1.5));
  };

  const handleZoomOut = () => {
    setIsManuallyZoomed(true);
    setScale(prev => Math.max(prev - 0.1, 0.4));
  };

  const handleResetZoom = () => {
    setIsManuallyZoomed(false);
    // Resetting manually zoomed flag will trigger the useLayoutEffect to re-calculate optimal scale
  };

  // Drag handlers for moveable template bar
  const handleDragStart = useCallback((e: ReactMouseEvent | ReactTouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: barPosition.x,
      initialY: barPosition.y,
    };
    setIsDragging(true);
  }, [barPosition]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current || !isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;

    setBarPosition({
      x: dragRef.current.initialX + deltaX,
      y: dragRef.current.initialY + deltaY,
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  // Attach global listeners when dragging
  useLayoutEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Download PDF using server-side Puppeteer (Netlify function)
  // Note: We now send pre-rendered HTML from the preview instead of resumeData
  const handleDownloadPdf = async () => {
    if (isDownloading) return;

    if (!hasRealResume) {
      console.warn('Cannot download PDF: No resume data available');
      return;
    }

    // Log export details for Scenario B verification
    const appliedCount = optimizations.filter(o => o.applied).length;
    const isExportingOptimized = showOptimized && appliedCount > 0;

    setIsDownloading(true);

    const filename = getSmartFilename(resumeData, selectedTemplate.id, 'pdf');

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

      // Update progress state
      useResumeStore.getState().setHasDownloaded(true);
    } catch (err) {
      console.error("PDF Download failed:", err);
      // TODO: Show user-facing error toast
    } finally {
      // Restore scroll
      setIsDownloading(false);
    }
  };

  // Download DOCX using docx library (client-side)
  const handleDownloadDocx = async () => {
    if (isDownloadingDocx || !hasRealResume || !resumeData) return;

    setIsDownloadingDocx(true);
    try {
      // Get keywords and bold preference from store
      const store = useResumeStore.getState();
      const keywords = store.optimizationMetrics?.jdKeywords || [];
      const boldKeywords = store.displayOptions?.boldKeywords ?? true;

      const { exportResumeAsDocx } = await import('../../services/exportDocx');
      const blob = await exportResumeAsDocx(resumeData as ResumeSchema, {
        keywords,
        boldKeywords,
        templateId: selectedTemplate.id as TemplateId,
      });
      const filename = getSmartFilename(resumeData, selectedTemplate.id, 'docx');
      saveAs(blob, filename);

      analytics.trackExport(selectedTemplate.id, 'docx');
      useResumeStore.getState().setHasDownloaded(true);
    } catch (err) {
      console.error('DOCX Download failed:', err);
    } finally {
      setIsDownloadingDocx(false);
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
      <GlassCard className="flex-1 flex flex-col backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden min-h-0 relative group">

        {/* Header Bar */}
        <div className="flex flex-col gap-3 p-4 md:p-5 border-b border-white/10 relative z-20 bg-gray-900/50 backdrop-blur-sm">
          {/* Top row: title + desktop buttons */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white transition-opacity duration-300 truncate">{selectedTemplate.name}</h3>
              <p className="text-sm text-white/60 flex items-center gap-1.5 mt-1">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                {t(`sections.templates.categories.${selectedTemplate.category.toLowerCase()}`, selectedTemplate.category.charAt(0).toUpperCase() + selectedTemplate.category.slice(1))}
                {contentLanguage && (
                  <span className="ms-2 px-2 py-0.5 bg-white/10 rounded text-xs font-medium">
                    {contentLanguage === 'ar'
                      ? t('sections.templates.languageArabic', 'العربية')
                      : contentLanguage === 'mixed'
                        ? t('sections.templates.languageMixed', 'Mixed')
                        : t('sections.templates.languageEnglish', 'English')}
                  </span>
                )}
              </p>
            </div>

            {/* Desktop-only action buttons */}
            <div className="hidden md:flex gap-3">
              <GlassButton
                onClick={() => setIsEditorOpen(true)}
                variant="secondary"
                disabled={!hasRealResume}
                className="border border-white/20"
              >
                <Edit3 className="w-4 h-4 me-2" />
                {t('sections.templates.editData', 'Edit Data')}
              </GlassButton>

              {hasAppliedOptimizations && (
                <GlassButton
                  onClick={() => setIsCompareOpen(true)}
                  variant="secondary"
                  className="border border-white/20"
                >
                  <ArrowLeftRight className="w-4 h-4 me-2" />
                  {t('sections.templates.compare', 'View Changes')}
                </GlassButton>
              )}

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

              <GlassButton
                onClick={handleDownloadDocx}
                variant="secondary"
                disabled={!hasRealResume || isDownloadingDocx}
                className="border border-white/20"
              >
                {isDownloadingDocx ? t('sections.templates.generating', 'Generating...') : (
                  <><FileText className="w-4 h-4 me-2" />{t('sections.templates.downloadDocx', 'DOCX')}</>
                )}
              </GlassButton>
            </div>
          </div>

          {/* Mobile-only action row: compact icon buttons */}
          <div className="flex md:hidden gap-2">
            <GlassButton
              onClick={() => setIsEditorOpen(true)}
              variant="secondary"
              disabled={!hasRealResume}
              size="sm"
              className="border border-white/20 flex-1"
            >
              <Edit3 className="w-4 h-4 me-1" />
              <span className="text-xs">{t('sections.templates.editData', 'Edit Data')}</span>
            </GlassButton>

            {hasAppliedOptimizations && (
              <GlassButton
                onClick={() => setIsCompareOpen(true)}
                variant="secondary"
                size="sm"
                className="border border-white/20 flex-1"
              >
                <ArrowLeftRight className="w-4 h-4 me-1" />
                <span className="text-xs">{t('sections.templates.compare', 'Changes')}</span>
              </GlassButton>
            )}

            <GlassButton
              onClick={handleDownloadPdf}
              variant="primary"
              disabled={!hasRealResume || isDownloading}
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-500 border-0 shadow-lg flex-1"
            >
              {isDownloading ? <span className="text-xs">{t('sections.templates.generating', '...')}</span> : (
                <><Download className="w-4 h-4 me-1" /><span className="text-xs">PDF</span></>
              )}
            </GlassButton>

            <GlassButton
              onClick={handleDownloadDocx}
              variant="secondary"
              disabled={!hasRealResume || isDownloadingDocx}
              size="sm"
              className="border border-white/20 flex-1"
            >
              {isDownloadingDocx ? <span className="text-xs">...</span> : (
                <><FileText className="w-4 h-4 me-1" /><span className="text-xs">DOCX</span></>
              )}
            </GlassButton>
          </div>

          <KeywordBoldingToggle />
        </div>

        {/* Zoom Controls Overlay - hidden on mobile (auto-fit), shown on desktop on hover */}
        <div className="hidden md:flex absolute top-24 right-4 md:right-6 rtl:right-auto rtl:left-4 rtl:md:left-6 z-30 flex-col gap-2 bg-black/70 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-xl md:opacity-0 md:hover:opacity-100 md:group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={handleZoomIn}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors active:scale-95"
            title={t('common.zoomIn', 'Zoom In')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors active:scale-95"
            title={t('common.zoomOut', 'Zoom Out')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-white/10 my-0.5" />
          <button
            onClick={handleResetZoom}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors active:scale-95"
            title={t('common.resetZoom', 'Reset Zoom')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>


        {/* No Resume Warning */}
        {!hasRealResume && (
          <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg relative z-10">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-400">
              {t('sections.templates.noResumeWarning', 'This is a preview. Upload your resume to see your data.')}
            </p>
          </div>
        )}

        {/* Preview Area with Formatting Panel */}
        <div className="relative flex-1 flex overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/30 min-h-0">

          {/* Formatting Panel - Left Side */}
          <div className="hidden md:block flex-shrink-0 p-3 overflow-y-auto">
            <FormattingPanel />
          </div>

          {/* Resume Preview - Right Side - Fit on screen, use zoom controls */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6">
            <div className="w-full flex justify-center pb-32 md:pb-20 pt-4">
              {/* Dynamic Scale Wrapper - centered and fit to viewport */}
              <div
                dir="ltr"
                className="relative bg-white shadow-2xl rounded-xl overflow-visible ring-1 ring-white/10 transition-transform duration-300 origin-top ease-out mx-auto"
                style={{
                  transform: `scale(${scale})`,
                  width: '210mm',
                  // Container takes scaled width to prevent clipping
                  marginBottom: `calc((1 - ${scale}) * -50%)`,
                }}
              >
                {/* Page Break Indicators Overlay */}
                {displayOptions.showPageBreaks && (
                  <PageBreakOverlay contentHeight={A4_PAGE_HEIGHT_PX * 2} />
                )}
                <TemplateRenderer
                  template={selectedTemplate}
                  userData={displayData as unknown as Record<string, unknown>}
                />
              </div>
            </div>

            {/* Draggable Template Selector - via Portal */}
            {createPortal(
              <div
                className={cn(
                  "fixed z-50 flex justify-center",
                  // Desktop: draggable with hover opacity
                  "md:cursor-grab",
                  isDragging && "md:cursor-grabbing",
                  "transition-opacity duration-200",
                  // Mobile: always full opacity; Desktop: fade unless hovered/dragged
                  "opacity-100 md:opacity-70",
                  (isHoveringSelector || isDragging) && "md:opacity-100"
                )}
                style={{
                  bottom: `calc(max(24px, env(safe-area-inset-bottom, 0px) + 8px) - ${barPosition.y}px)`,
                  left: `calc(50% + ${barPosition.x}px)`,
                  transform: 'translateX(-50%)',
                  maxWidth: 'calc(100vw - 16px)',
                }}
                onMouseEnter={() => setIsHoveringSelector(true)}
                onMouseLeave={() => !isDragging && setIsHoveringSelector(false)}
              >
                <div className="flex items-center gap-1 px-2 py-2 bg-black/90 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl overflow-x-auto max-w-full no-scrollbar">
                  {/* Drag Handle - hidden on mobile for space */}
                  <div
                    className="hidden md:block p-2 text-white/50 hover:text-white cursor-grab active:cursor-grabbing touch-none shrink-0"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    <GripHorizontal className="w-4 h-4" />
                  </div>

                  {/* Template Pills */}
                  {activeTemplates.map((template) => {
                    const isSelected = selectedTemplate.id === template.id;
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0",
                          isSelected
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md scale-105"
                            : "text-white/70 hover:text-white hover:bg-white/10"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        {template.name}
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>



        {/* PDF Generation Loading Overlay - Full Screen via Portal */}
        {isDownloading && createPortal(
          <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
            <LoadingMessages type="pdf" estimatedTime={8000} />
          </div>,
          document.body
        )}
      </GlassCard>

      {/* Manual Data Editor Modal */}
      <ManualDataEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />

      {/* Resume Diff View Modal */}
      {isCompareOpen && (
        <Suspense fallback={null}>
          <ResumeDiffView
            isOpen={isCompareOpen}
            onClose={() => setIsCompareOpen(false)}
            optimizations={optimizations}
          />
        </Suspense>
      )}
    </div >
  );
}

/**
 * Keyword Bolding Toggle Component
 * Separated to avoid React Hooks rules violations (hooks can't be conditional)
 */
function KeywordBoldingToggle() {
  const { t } = useTranslation();
  const hasKeywords = useResumeStore(state => state.optimizationMetrics.jdKeywords.length > 0);
  const boldKeywords = useResumeStore(state => state.displayOptions.boldKeywords);

  if (!hasKeywords) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <input
        type="checkbox"
        id="bold-keywords-toggle"
        checked={boldKeywords}
        onChange={(e) => {
          useResumeStore.getState().setDisplayOptions({ boldKeywords: e.target.checked });
        }}
        className="w-4 h-4 text-emerald-600 bg-white/10 border-white/30 rounded focus:ring-emerald-500 focus:ring-offset-0 focus:ring-2 cursor-pointer"
      />
      <label htmlFor="bold-keywords-toggle" className="text-sm text-white/80 cursor-pointer select-none">
        {t('sections.templates.boldKeywords', 'Bold important keywords in DOCX exports')}
      </label>
      <div className="relative inline-flex" onMouseEnter={(e) => { const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement; if (tip) tip.style.display = 'block'; }} onMouseLeave={(e) => { const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement; if (tip) tip.style.display = 'none'; }}>
        <Info className="w-4 h-4 text-white/40 hover:text-white/60 cursor-help transition-colors" />
        <div data-tooltip style={{ display: 'none' }} className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-black/90 text-white/90 text-xs rounded-lg shadow-xl border border-white/10 z-50 pointer-events-none">
          {t('sections.templates.boldKeywordsTooltip', 'Emphasizes top 15 keywords from job description in downloaded DOCX files (resume + cover letter)')}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90" />
        </div>
      </div>
    </div>
  );
}
