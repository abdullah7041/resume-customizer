// src/components/sections/TemplatesSection.tsx
// Resume template gallery with floating overlay template selector

import { useState, useMemo, useLayoutEffect, useRef, useCallback, lazy, Suspense, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { Download, Check, Sparkles, AlertCircle, Edit3, ZoomIn, ZoomOut, RotateCcw, GripHorizontal, FileText, ArrowLeftRight } from "lucide-react";
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

/**
 * Build a self-contained HTML document from the preview element.
 *
 * Previous approach inlined a whitelist of ~40 computed style properties and
 * stripped all class names, which lost flex sizing, combinatorial selectors
 * (e.g. space-y-*), pseudo-elements, CSS variables, and more — causing
 * widespread layout breakage in the Puppeteer-rendered PDF.
 *
 * New approach: extract the page's full compiled CSS from `document.styleSheets`
 * and bundle it with the class-name–bearing HTML.  This guarantees the PDF
 * matches the browser preview exactly.  Typical payload is 200-600 KB,
 * well within the Netlify function's 6 MB limit.
 */
function buildInlinedHtml(element: HTMLElement, title: string = 'Resume'): string {
  // Clone the full element tree — class names AND inline styles are preserved
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove elements that should not appear in the PDF
  clone.querySelectorAll('[data-no-print]').forEach((el) => el.remove());

  // ---- Extract compiled CSS from all accessible stylesheets ----
  // This captures every Tailwind utility, component style, CSS variable,
  // combinatorial selector (space-y-*, etc.), and pseudo-element rule
  // that the browser preview uses.
  const cssChunks: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        cssChunks.push(rule.cssText);
      }
    } catch {
      // Cross-origin sheets (e.g. Google Fonts CDN) can't be read.
      // Templates use system-font fallback stacks, so this is safe.
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
* {box-sizing:border-box;margin:0;padding:0}
body{background:#fff}
svg{display:inline-block;vertical-align:middle}
${cssChunks.join('\n')}
</style></head>
<body>${clone.outerHTML}</body>
</html>`;
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
    // We must depend on these values so the memo recomputes when editor saves or optimizations change
    return getActiveResume();

  }, [useStoreData, getActiveResume, storeOriginalResume, optimizations, showOptimized]);

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

      if (width < 640) { // Mobile
        // MainContent p-4 (32px) + GlassCard border (2px) + scroll container p-2 (16px) = 50px
        const totalPadding = 16 * 2 + 2 + 8 * 2; // 50px
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

  // Download PDF — primary: instant client-side html2canvas + jsPDF (works for ALL templates).
  // Safari (mobile + desktop) pre-opens a window synchronously to bypass transient-activation blocking.
  // Fallback: server-side Puppeteer only if client-side generation fails.
  const handleDownloadPdf = async () => {
    if (isDownloading) return;

    if (!hasRealResume) {
      console.warn('Cannot download PDF: No resume data available');
      return;
    }


    const appliedCount = optimizations.filter(o => o.applied).length;
    const _isExportingOptimized = showOptimized && appliedCount > 0; // retained for future analytics

    setIsDownloading(true);

    const filename = getSmartFilename(resumeData, selectedTemplate.id, 'pdf');

    // -----------------------------------------------------------------------
    // SAFARI FIX (mobile + macOS desktop) — must pre-open window SYNCHRONOUSLY.
    //
    // Safari enforces "transient activation": window.open() is only permitted
    // inside a synchronous user-gesture handler. Any dynamic import or fetch
    // call expires the activation window, Safari then silently blocks the popup.
    //
    // Detection:
    //  • isMobile        — iOS Safari on iPhone/iPad
    //  • isSafariDesktop — macOS Safari (has "Safari" in UA but NOT "Chrome"
    //                      or "Chromium", which both append "Safari" to their UA)
    //
    // Fix: pre-open a blank tab NOW, redirect its .location.href to the blob
    // URL after async work finishes. Chrome/Firefox/Edge handle <a download>
    // with blob URLs correctly and take the standard saveAs() path.
    // -----------------------------------------------------------------------
    const ua = navigator.userAgent;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const isSafariDesktop = /^((?!Chrome|Chromium|Android).)*Safari/i.test(ua) && !isMobile;
    const needsWindowRedirect = isMobile || isSafariDesktop;

    let safariWindow: Window | null = null;
    if (needsWindowRedirect) {
      safariWindow = window.open('', '_blank');
      if (safariWindow) {
        safariWindow.document.write('<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb"><p style="color:#6b7280;font-size:16px">Generating your PDF…</p></body></html>');
        safariWindow.document.close();
      }
    }

    try {
      const previewElement = document.querySelector('[data-resume-preview]') as HTMLElement;
      if (!previewElement) throw new Error('Preview not found — unable to capture HTML');

      // -----------------------------------------------------------------------
      // PRIMARY PATH — Instant client-side PDF via html2canvas + jsPDF.
      //
      // WHY this is now primary (was previously fallback):
      //  • Works for ALL templates — no server payload size limit
      //  • No cold-start delay (eliminates the 5–12 s server round-trip)
      //  • html2canvas reads computed styles from the live DOM, so Tailwind
      //    utilities, CSS variables, and flex/grid layouts render correctly for
      //    every template — not just ATS Optimized.
      //
      // KEY options:
      //  scale: 2          → 2× pixel density = crisp retina-quality output
      //  windowWidth/Height → A4 px dims so the clone doesn't trigger mobile
      //                       media-query breakpoints that reflow the layout
      //  onclone           → mutate the non-destructive DOM clone before capture:
      //    1. Remove [data-no-print] overlays (page-break indicators, etc.)
      //    2. Reset CSS transform on the scale wrapper so the clone renders at
      //       full 1:1 size instead of the UI's 0.9× viewport-fit thumbnail.
      //       Without this the canvas is 90% of A4 and jsPDF stretches it blurry.
      // -----------------------------------------------------------------------
      let clientSuccess = false;
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);

        const canvas = await html2canvas(previewElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 794,   // A4 at 96 DPI — prevents layout reflow in clone
          windowHeight: 1123,
          onclone: (_clonedDoc, clonedEl) => {
            // 1. Strip non-printable overlays
            clonedEl.querySelectorAll('[data-no-print]').forEach(el => el.remove());
            
            // 2. Reset scale transform on any outer wrappers
            const wrapper = (
              clonedEl.closest?.('[style*="transform"]') as HTMLElement | null
              ?? clonedEl.parentElement?.closest?.('[style*="transform"]') as HTMLElement | null
            );
            if (wrapper) {
              wrapper.style.transform = 'none';
              wrapper.style.width = '210mm';
            }
            if (clonedEl.style.transform) clonedEl.style.transform = 'none';
            clonedEl.style.width = '210mm';

            // 3. Reset transform on any inner template containers
            const innerTf = clonedEl.querySelectorAll('[style*="transform"]');
            innerTf.forEach(el => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.transform = 'none';
              // Force dimensions to A4 to prevent reflow clipping
              htmlEl.style.width = '210mm';
              htmlEl.style.maxWidth = '100%';
              htmlEl.style.height = 'auto'; // let height grow organically
              htmlEl.style.minHeight = '297mm';
            });
            
            // 4. Force print layout rules uniformly across children
            clonedEl.style.overflow = 'visible';
            clonedEl.style.boxSizing = 'border-box';

            // 5. Intelligent Pagination Engine
            // Find logic blocks that shouldn't be cut across pages.
            // Targeting common resume container/text elements.
            const selectors = [
              '.resume-section > div', // Main job entries / education entries
              '.space-y-4 > div',
              '.space-y-3 > div',
              '.border-l-2', // Timeline items
              'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              '[data-prevent-page-break]'
            ].join(', ');

            // element list in document order (parents before children)
            const blocks = Array.from(clonedEl.querySelectorAll(selectors)) as HTMLElement[];

            const PAGE_HEIGHT = 1122.5; // 297mm in pixels at 96 DPI (793.7 width * 1.414 ratio)
            
            blocks.forEach(block => {
              const wrapperRect = clonedEl.getBoundingClientRect();
              const rect = block.getBoundingClientRect();
              
              const relativeTop = rect.top - wrapperRect.top;
              const relativeBottom = rect.bottom - wrapperRect.top;

              const startPage = Math.floor(relativeTop / PAGE_HEIGHT);
              const endPage = Math.floor(relativeBottom / PAGE_HEIGHT);

              // If the block crosses a page boundary AND isn't taller than a whole page itself
              // This dynamically keeps parents intact if they fit. If a parent is too tall, 
              // it skips the parent and the loop eventually reaches its children, breaking them instead!
              if (startPage !== endPage && (relativeBottom - relativeTop) < PAGE_HEIGHT) {
                const currentMarginTop = parseFloat(window.getComputedStyle(block).marginTop || '0');
                // Calculate distance required to push the TOP of the element precisely past the 297mm cutline
                const distanceToNextPage = ((startPage + 1) * PAGE_HEIGHT) - relativeTop;
                
                // Add spacer gap + 20px padding so it doesn't touch the immediate cut edge
                block.style.marginTop = `${currentMarginTop + distanceToNextPage + 20}px`;
              }
            });
          },
        });

        // JPEG (0.95 quality) is slightly smaller + faster to encode than PNG
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
        const pdfWidth = pdf.internal.pageSize.getWidth();    // 210 mm
        const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
        const totalHeightMm = (canvas.height / canvas.width) * pdfWidth;

        // Slice into A4 pages perfectly safely, because the clone was padded with white gaps!
        let heightLeft = totalHeightMm;
        let position = 0;
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalHeightMm);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalHeightMm);
          heightLeft -= pageHeight;
        }

        // Deliver the PDF
        if (needsWindowRedirect && safariWindow) {
          // Safari: redirect the pre-opened tab to the blob URL.
          // Safari ignores <a download> for blobs but correctly displays a
          // blob URL redirected from a window that was opened synchronously
          // within the original user-gesture activation window.
          const pdfBlob = pdf.output('blob');
          const blobUrl = URL.createObjectURL(pdfBlob);
          safariWindow.location.href = blobUrl;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        } else {
          // Chrome / Firefox / Edge — standard anchor-click download
          saveAs(pdf.output('blob') as Blob, filename);
        }

        clientSuccess = true;
      } catch (clientErr) {
        if (import.meta.env.DEV) console.warn('[PDF] Client-side generation failed, trying server:', clientErr);
      }

      // -----------------------------------------------------------------------
      // FALLBACK — Server-side Puppeteer (only if client-side fails).
      // Kept as a safety net for edge-cases (complex SVG gradients, etc.).
      // -----------------------------------------------------------------------
      if (!clientSuccess) {
        try {
          const html = buildInlinedHtml(previewElement, filename.replace('.pdf', ''));
          const { getAuthHeaders } = await import('../../services/api');
          const headers = await getAuthHeaders();
          const response = await fetch('/.netlify/functions/generate-pdf', {
            method: 'POST',
            headers,
            body: JSON.stringify({ html, templateId: selectedTemplate.id }),
          });

          if (response.ok) {
            const blob = await response.blob();
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(pdfBlob);
            if (needsWindowRedirect && safariWindow) {
              safariWindow.location.href = blobUrl;
              setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            } else {
              saveAs(pdfBlob, filename);
            }
          } else {
            // Last resort: open rendered HTML so user can browser-print to PDF
            const fallbackWindow = safariWindow ?? window.open('', '_blank');
            if (fallbackWindow) {
              const html = buildInlinedHtml(previewElement, filename.replace('.pdf', ''));
              fallbackWindow.document.write(html);
              fallbackWindow.document.close();
            }
          }
        } catch (serverErr) {
          console.error('[PDF] All generation methods failed:', serverErr);
          if (safariWindow && !safariWindow.closed) safariWindow.close();
        }
      }

      analytics.trackExport(selectedTemplate.id, 'pdf');
      useResumeStore.getState().setHasDownloaded(true);
    } catch (err) {
      console.error('PDF Download failed:', err);
      if (safariWindow && !safariWindow.closed) safariWindow.close();
    } finally {
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
      <GlassCard padding="none" className="flex-1 flex flex-col neu-card rounded-2xl overflow-hidden min-h-0 relative group">

        {/* Header Bar */}
        <div className="flex flex-col gap-2 p-3 md:p-5 border-b border-gray-200 dark:border-white/10 relative z-20 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
          {/* Top row: title + desktop buttons */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white transition-opacity duration-300 truncate">{selectedTemplate.name}</h3>
              <p className="text-xs md:text-sm text-gray-500 dark:text-white/60 flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {t(`sections.templates.categories.${selectedTemplate.category.toLowerCase()}`, selectedTemplate.category.charAt(0).toUpperCase() + selectedTemplate.category.slice(1))}
                {contentLanguage && (
                  <span className="ms-2 px-2 py-0.5 bg-gray-200/50 dark:bg-white/10 rounded text-xs font-medium">
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
                className="border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white"
              >
                <Edit3 className="w-4 h-4 me-2" />
                {t('sections.templates.editData', 'Edit Data')}
              </GlassButton>

              {hasAppliedOptimizations && (
                <GlassButton
                  onClick={() => setIsCompareOpen(true)}
                  variant="secondary"
                  className="border border-gray-300 dark:border-white/20"
                >
                  <ArrowLeftRight className="w-4 h-4 me-2" />
                  {t('sections.templates.compare', 'View Changes')}
                </GlassButton>
              )}

              <GlassButton
                onClick={handleDownloadPdf}
                variant="primary"
                disabled={!hasRealResume || isDownloading}
                className="btn-metal border border-emerald-500/30 text-emerald-900 dark:text-white"
              >
                {isDownloading ? t('sections.templates.generating', 'Generating...') : (
                  <><Download className="w-4 h-4 me-2" />{t('sections.templates.downloadPdf', 'Download PDF')}</>
                )}
              </GlassButton>

              <GlassButton
                onClick={handleDownloadDocx}
                variant="secondary"
                disabled={!hasRealResume || isDownloadingDocx}
                className="border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white"
              >
                {isDownloadingDocx ? t('sections.templates.generating', 'Generating...') : (
                  <><FileText className="w-4 h-4 me-2" />{t('sections.templates.downloadDocx', 'DOCX')}</>
                )}
              </GlassButton>
            </div>
          </div>

          {/* Mobile-only action row */}
          <div className="flex md:hidden flex-wrap gap-1.5">
            <GlassButton
              onClick={handleDownloadPdf}
              variant="primary"
              disabled={!hasRealResume || isDownloading}
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-500 border-0 shadow-lg !px-2.5 !py-1.5 !rounded-lg !text-xs"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="ms-1">PDF</span>
            </GlassButton>

            <GlassButton
              onClick={handleDownloadDocx}
              variant="secondary"
              disabled={!hasRealResume || isDownloadingDocx}
              size="sm"
              className="border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white !px-2.5 !py-1.5 !rounded-lg !text-xs"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="ms-1">DOCX</span>
            </GlassButton>

            <GlassButton
              onClick={() => setIsEditorOpen(true)}
              variant="secondary"
              disabled={!hasRealResume}
              size="sm"
              className="border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white !px-2.5 !py-1.5 !rounded-lg !text-xs"
            >
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <span className="ms-1">{t('sections.templates.editData', 'Edit')}</span>
            </GlassButton>

            {hasAppliedOptimizations && (
              <GlassButton
                onClick={() => setIsCompareOpen(true)}
                variant="secondary"
                size="sm"
                className="border border-gray-300 dark:border-white/20 !px-2.5 !py-1.5 !rounded-lg !text-xs"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                <span className="ms-1">{t('sections.templates.compare', 'Changes')}</span>
              </GlassButton>
            )}
          </div>

          <KeywordBoldingToggle />
        </div>

        {/* Zoom Controls Overlay - hidden on mobile (auto-fit), shown on desktop on hover */}
        <div className="hidden md:flex absolute top-24 end-4 md:end-6 z-30 flex-col gap-2 bg-white/70 dark:bg-black/70 backdrop-blur-md p-1.5 rounded-lg border border-gray-300/50 dark:border-white/10 shadow-xl md:opacity-0 md:hover:opacity-100 md:group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors active:scale-95"
            title={t('common.zoomIn', 'Zoom In')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors active:scale-95"
            title={t('common.zoomOut', 'Zoom Out')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-gray-300 dark:bg-white/10 my-0.5" />
          <button
            onClick={handleResetZoom}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-colors active:scale-95"
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
        <div className="relative flex-1 flex overflow-hidden bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-gray-900/50 dark:to-gray-800/30 min-h-0">

          {/* Formatting Panel - Left Side */}
          <div className="hidden md:block flex-shrink-0 p-3 overflow-y-auto">
            <FormattingPanel />
          </div>

          {/* Resume Preview - Right Side - Fit on screen, use zoom controls */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-6">
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
                <div className="flex items-center gap-1 px-2 py-2 neu-card rounded-full max-w-full no-scrollbar overflow-x-auto shadow-2xl">
                  {/* Drag Handle - hidden on mobile for space */}
                  <div
                    className="hidden md:block p-2 text-gray-400 hover:text-gray-900 dark:text-white/50 dark:hover:text-white cursor-grab active:cursor-grabbing touch-none shrink-0"
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
                            ? "btn-metal text-emerald-900 dark:text-white scale-105 shadow-md border-emerald-500/30"
                            : "text-gray-600 hover:text-gray-900 hover:bg-black/5 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10 btn-spring"
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
            <LoadingMessages type="pdf" estimatedTime={2000} />
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
    <label htmlFor="bold-keywords-toggle" className="flex items-center gap-2 px-1 cursor-pointer select-none">
      <input
        type="checkbox"
        id="bold-keywords-toggle"
        checked={boldKeywords}
        onChange={(e) => {
          useResumeStore.getState().setDisplayOptions({ boldKeywords: e.target.checked });
        }}
        className="w-4 h-4 shrink-0 text-emerald-600 bg-gray-200/50 dark:bg-white/10 border-gray-300 dark:border-white/30 rounded focus:ring-emerald-500 focus:ring-offset-0 focus:ring-2 cursor-pointer"
      />
      <span className="text-xs sm:text-sm text-gray-700 dark:text-white/80">
        {t('sections.templates.boldKeywords', 'Bold important keywords in DOCX exports')}
      </span>
    </label>
  );
}
