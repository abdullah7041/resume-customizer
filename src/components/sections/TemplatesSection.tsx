// src/components/sections/TemplatesSection.tsx
/**
 * PDF GENERATION DIAGNOSTIC AUDIT
 * ===============================
 * Files importing html2canvas, html2canvas-pro, html-to-image, or jspdf:
 * - src/components/ui/ShareScoreCard.tsx
 * - src/components/sections/TemplatesSection.tsx
 * - src/components/sections/BulkAnalysisSection.tsx
 * 
 * Target PDF generation trigger:
 * - `handleDownloadPdf` in `TemplatesSection.tsx`
 * 
 * Intelligent Pagination Engine behavior:
 * - Mutates DOM elements to identify text blocks and section containers that cross the threshold of A4 pages (1122.5px slices).
 * - Applies a computed `marginTop` pushing the truncated elements entirely onto the next PDF page. Needs `wrapperRect` calculation against exact UI scale. 
 *
 * `netlify/functions/generate-pdf` input shape:
 * - Takes `{ html, templateId }`. Historically, this fell short because it lacked pagination modifications.
 */
// Resume template gallery with floating overlay template selector

import { useState, useMemo, useLayoutEffect, useRef, useCallback, lazy, Suspense, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { Download, Check, Sparkles, AlertCircle, Edit3, ZoomIn, ZoomOut, RotateCcw, GripHorizontal, FileText, ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES } from "../../lib/data/resumeTemplates";
import { useResumeStore } from "../../lib/stores/resumeStore";
import { analytics } from "../../services/analytics";
import { requestValueMomentFeedbackPrompt } from "../Feedback/FeedbackPromptController";

import TemplateRenderer from "../templates/TemplateRenderer";
import { GlassButton } from "../ui/GlassButton";
import { GlassCard } from "../ui/GlassCard";
import { ConfirmActionModal } from "../Credits/ConfirmActionModal";
import { LoadingMessages } from "../LoadingMessages";
import { ManualDataEditor } from "../ui/ManualDataEditor";
import { FormattingPanel } from "../ui/FormattingPanel";
import { PageBreakOverlay, A4_PAGE_HEIGHT_PX } from "../ui/PageBreakIndicator";
import { useResumeLanguage } from "../../hooks/useResumeLanguage";
import { directionFromLanguage } from "../../lib/utils/resumeDirection";

const ResumeDiffView = lazy(() => import("./ResumeDiffView"));

const DRAG_HANDLE_KEYBOARD_STEP_PX = 12;

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
      region: 'Riyadh Province',
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

const summarizeErrorForConsole = (error: unknown) => ({
  name: error instanceof Error ? error.name : 'Error',
  message: error instanceof Error ? error.message : String(error),
});

const forceLightThemeForPdf = (root: HTMLElement) => {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('[class]'))];
  for (const element of elements) {
    const classValue = element.getAttribute('class');
    if (!classValue) continue;
    const lightClasses = classValue
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => token !== 'dark' && !token.startsWith('dark:') && !token.includes(':dark:'));
    element.setAttribute('class', Array.from(new Set([...lightClasses, 'light'])).join(' '));
  }

  root.classList.remove('dark');
  root.classList.add('light');
  root.setAttribute('data-theme', 'light');
  root.setAttribute('data-pdf-theme', 'light');
  root.style.colorScheme = 'light';
  root.style.backgroundColor = '#ffffff';
  root.style.color = '#111827';
};

// html-to-image's createImage() awaits a requestAnimationFrame callback that
// browsers suspend indefinitely once the tab is backgrounded/hidden — with
// no rejection of its own, that would otherwise hang "Generating..." forever.
const CLIENT_FALLBACK_TIMEOUT_MS = 20_000;

const waitForPdfCaptureLayout = async (root: HTMLElement): Promise<void> => {
  const fontsReady = document.fonts?.ready;
  if (fontsReady) {
    await fontsReady.catch(() => undefined);
  }

  await Promise.all(Array.from(root.querySelectorAll('img')).map(async (image) => {
    if (typeof image.decode === 'function') {
      await image.decode().catch(() => undefined);
    }
  }));

  if (typeof window.requestAnimationFrame !== 'function') return;
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
};

/**
 * The client-side raster fallback (html-to-image + jsPDF) has historically
 * produced a blank canvas for an off-screen-positioned clone on some
 * browsers/timing without ever throwing — the download "succeeds" with a
 * white page and no visible error. Sample a coarse grid of pixels and treat
 * the canvas as blank when every sampled pixel is background-colored or
 * transparent, so the caller can surface a real error instead of shipping
 * an empty PDF.
 */
const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
  if (canvas.width === 0 || canvas.height === 0) return true;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false; // can't verify — don't block a possibly-valid export
    const gridSize = 24;
    const stepX = Math.max(1, Math.floor(canvas.width / gridSize));
    const stepY = Math.max(1, Math.floor(canvas.height / gridSize));
    for (let y = 0; y < canvas.height; y += stepY) {
      const row = ctx.getImageData(0, y, canvas.width, 1).data;
      for (let x = 0; x < canvas.width; x += stepX) {
        const i = x * 4;
        const isOpaque = row[i + 3] > 10;
        const isNonWhite = row[i] < 250 || row[i + 1] < 250 || row[i + 2] < 250;
        if (isOpaque && isNonWhite) return false;
      }
    }
    return true;
  } catch {
    return false; // tainted canvas — can't verify, don't block export
  }
};



interface TemplateGalleryProps {
  resumeData?: ResumeSchema | null;
  optimizationData?: unknown;
  onSelectTemplate?: (template: typeof resumeTemplates[0]) => void;
  /**
   * Runs one credit-charged optimize over the current job/resume before a
   * guest-preview-origin export/save can proceed (see optimizationOrigin).
   * Resolves with a truthy result on success; MainContent supplies this as
   * `() => handleOptimize('auto', { freePreview: false })`.
   */
  onRequirePaidReoptimize?: () => Promise<unknown>;
}

export default function TemplateGallery({ resumeData: propResumeData, optimizationData, onSelectTemplate, onRequirePaidReoptimize }: TemplateGalleryProps) {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState(resumeTemplates[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [isHoveringSelector, setIsHoveringSelector] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isManuallyZoomed, setIsManuallyZoomed] = useState(false);
  const [showAdvancedFormatting, setShowAdvancedFormatting] = useState(false);

  // Guest-preview export/save gate — see optimizationOrigin.
  const [pendingExportAction, setPendingExportAction] = useState<'pdf' | 'docx' | null>(null);
  const [isReoptimizing, setIsReoptimizing] = useState(false);

  // Draggable template bar state
  const [barPosition, setBarPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Get resume data from store - subscribe to all relevant state for reactivity
  const storeOriginalResume = useResumeStore((state) => state.originalResume);
  const optimizations = useResumeStore((state) => state.optimizations);
  const showOptimized = useResumeStore((state) => state.showOptimized);
  const optimizationOrigin = useResumeStore((state) => state.optimizationOrigin);
  // isSaudiNational is used by getActiveResume internally
  const getActiveResume = useResumeStore((state) => state.getActiveResume);
  const setStoreTemplate = useResumeStore((state) => state.setSelectedTemplate);
  const displayOptions = useResumeStore((state) => state.displayOptions);

  // Detect resume content language
  const contentLanguage = useResumeLanguage();
  const contentDirection = directionFromLanguage(contentLanguage);

  // Determine if store has applied optimizations - THIS TAKES PRIORITY
  const hasAppliedOptimizations = optimizations.some(o => o.applied);
  // Guest carryover guard: the applied optimizations came from a free/guest
  // preview run (no credits charged) and have not been re-run since signing
  // in. Export/save must not realize that value for free.
  const isGuestPreviewExport = hasAppliedOptimizations && optimizationOrigin === 'guest_preview';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useStoreData, getActiveResume, storeOriginalResume, optimizations, showOptimized]);

  // Determine which resume to use
  const resumeData = useStoreData
    ? (storeActiveResume || storeOriginalResume)
    : propResumeData;
  const hasRealResume = Boolean(resumeData?.basics?.name);
  const exportFailureMessage = t(
    'sections.templates.export.failed',
    'Export failed. Please try again, or switch to the ATS-friendly template and retry.'
  );
  const exportTimeoutMessage = t(
    'sections.templates.export.timeout',
    'Export is taking unusually long — bring this browser tab into focus (some browsers pause rendering work in background tabs) and try again.'
  );

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

    return data;
  }, [useStoreData, storeActiveResume, storeOriginalResume, propResumeData]);

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
      } else if (width < 1024) { // Tablet, no formatting panel
        const tabletPadding = 24 * 2 + 16 * 2;
        const tabletScale = (width - tabletPadding) / a4WidthPx;
        setScale(Math.max(Math.min(tabletScale, 0.9), 0.65));
      } else if (width < 1280) { // Small desktop
        const formattingPanelWidth = showAdvancedFormatting ? 288 + 24 : 0;
        const previewPadding = 24 * 2;
        const shellPadding = 32;
        const available = width - formattingPanelWidth - previewPadding - shellPadding;
        const fittedScale = available / a4WidthPx;
        setScale(Math.max(Math.min(fittedScale, 0.9), 0.65));
      } else {
        setScale(0.9); // Desktop: 90% scale for "fit" look with margins
      }
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isManuallyZoomed, showAdvancedFormatting]);


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

  const handleDragHandleKeyDown = useCallback((e: ReactKeyboardEvent) => {
    const delta = {
      ArrowLeft: { x: -DRAG_HANDLE_KEYBOARD_STEP_PX, y: 0 },
      ArrowRight: { x: DRAG_HANDLE_KEYBOARD_STEP_PX, y: 0 },
      ArrowUp: { x: 0, y: -DRAG_HANDLE_KEYBOARD_STEP_PX },
      ArrowDown: { x: 0, y: DRAG_HANDLE_KEYBOARD_STEP_PX },
    }[e.key];
    if (!delta) return;
    e.preventDefault();
    setBarPosition((prev) => ({ x: prev.x + delta.x, y: prev.y + delta.y }));
  }, []);

  // Attach global listeners when dragging
  useLayoutEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: true });
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Download PDF — Server-side Puppeteer rendering
  const performDownloadPdf = async () => {
    if (isDownloading || !hasRealResume || !resumeData) return;
    setIsDownloading(true);
    setExportError(null);
    analytics.trackExportClicked(selectedTemplate.id, 'pdf');

    try {
      const filename = getSmartFilename(resumeData, selectedTemplate.id, 'pdf');

      // 1. Clone DOM off-screen
      const previewElement = document.querySelector('[data-resume-preview]') as HTMLElement;
      if (!previewElement) throw new Error('Preview not found — unable to capture HTML');

      const clone = previewElement.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      document.body.appendChild(clone);

      // 2. Run pagination mutations
      const wrapper = (
        clone.closest?.('[style*="transform"]') as HTMLElement | null
        ?? clone.parentElement?.closest?.('[style*="transform"]') as HTMLElement | null
      );
      if (wrapper) {
        wrapper.style.transform = 'none';
        wrapper.style.width = '210mm';
      }
      if (clone.style.transform) clone.style.transform = 'none';
      clone.style.width = '210mm';

      const innerTf = clone.querySelectorAll('[style*="transform"]');
      innerTf.forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.transform = 'none';
        htmlEl.style.width = '210mm';
        htmlEl.style.maxWidth = '100%';
        htmlEl.style.height = 'auto'; // let height grow organically
        htmlEl.style.minHeight = 'auto'; // Must NOT be 297mm — that forces a full-page blank gap when content is shorter
      });
      
      clone.style.overflow = 'visible';
      clone.style.boxSizing = 'border-box';

      // 3. inline all images as base64 so Puppeteer doesn't need to load external URLs.
      // Images are independent, so fetch them concurrently.
      const images = clone.querySelectorAll('img');
      await Promise.all(Array.from(images).map(async (img) => {
        try {
          if (img.src && !img.src.startsWith('data:')) {
            const res = await fetch(img.src);
            const imageBlob = await res.blob();
            const base64Data = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(imageBlob);
            });
            img.src = base64Data as string;
          }
        } catch (e) {
          console.warn('Could not inline image for PDF:', summarizeErrorForConsole(e));
        }
      }));

      // 4. Remove no-print elements
      clone.querySelectorAll('[data-no-print]').forEach(el => el.remove());
      forceLightThemeForPdf(clone);

      // 5. Capture HTML + styles (STRIP off-screen positioning first!)
      clone.style.position = 'static';
      clone.style.left = '0';
      clone.style.top = '0';
      const html = clone.outerHTML;

      // Capture all internal <style> blocks
      const inlineStyles = Array.from(document.querySelectorAll('style'))
        .map(style => style.innerHTML)
        .join('\n');

      // Capture and fetch all external <link rel="stylesheet"> files
      const linkTags = document.querySelectorAll('link[rel="stylesheet"]');
      const hrefs = Array.from(linkTags).map(link => (link as HTMLLinkElement).href);
      const externalStyles = await Promise.all(
        hrefs.map(async href => {
          try {
            const resp = await fetch(href);
            return await resp.text();
          } catch {
            return '';
          }
        })
      );

      const styles = inlineStyles + '\n' + externalStyles.join('\n');

      document.body.removeChild(clone);

      // 5. Send to Server (Netlify Function)
      const { getAuthHeaders } = await import('../../services/api');
      const apiHeaders = await getAuthHeaders({ requireAuth: true });
      const response = await fetch('/.netlify/functions/generate-pdf', {
        method: 'POST',
        headers: { ...apiHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, styles, templateId: selectedTemplate.id, filename: filename.replace('.pdf', ''), direction: contentDirection }),
      });

      if (!response.ok) throw new Error(`[PDFDownload] Server error: ${response.status}`);

      const blob = await response.blob();
      if (!blob || blob.size === 0) throw new Error('[PDFDownload] Server returned an empty PDF');

      // 6. Mobile-safe Download
      // iOS Safari frequently blocks navigator.share or blob URLs after async fetch delays.
      // Data URLs bypass the transient user activation restriction and trigger the native iOS download prompt.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = reader.result as string;
          a.download = typeof filename === 'string' && filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
        reader.readAsDataURL(blob);
      } else {
        saveAs(blob, typeof filename === 'string' && filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
      }

      analytics.trackExportSuccess(selectedTemplate.id, 'pdf');
      requestValueMomentFeedbackPrompt('export_success');
      useResumeStore.getState().setHasDownloaded(true);

    } catch (err) {
      console.error('[PDFDownload] Failed server-side generation, attempting client-side fallback:', summarizeErrorForConsole(err));
      analytics.trackExportFailed(selectedTemplate.id, 'pdf', 'server_error');

      try {
        // Dynamic import to keep bundle size small
        const [{ toCanvas }, { jsPDF }] = await Promise.all([
          import('html-to-image'),
          import('jspdf')
        ]);

        const previewElement = document.querySelector('[data-resume-preview]') as HTMLElement;
        if (!previewElement) throw new Error('Preview not found for fallback');

        // Capture an isolated light clone so fallback export never mutates the live preview.
        // html-to-image can rasterize a blank page when a capture target sits at
        // a large negative x-offset, especially on mobile Safari. Keep it in the
        // viewport, behind the app, instead of rendering it visibly to the user.
        const fallbackHost = document.createElement('div');
        fallbackHost.setAttribute('data-pdf-capture-host', 'true');
        fallbackHost.setAttribute('aria-hidden', 'true');
        fallbackHost.setAttribute('inert', '');
        Object.assign(fallbackHost.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          zIndex: '-1',
          width: '210mm',
          minHeight: '1px',
          overflow: 'visible',
          pointerEvents: 'none',
        });
        const fallbackClone = previewElement.cloneNode(true) as HTMLElement;
        fallbackClone.style.position = 'static';
        fallbackClone.style.left = '';
        fallbackClone.style.top = '';
        fallbackClone.style.width = '210mm';
        fallbackClone.style.overflow = 'visible';
        fallbackClone.style.boxSizing = 'border-box';
        fallbackHost.appendChild(fallbackClone);
        document.body.appendChild(fallbackHost);
        forceLightThemeForPdf(fallbackClone);
        fallbackClone.querySelectorAll('[data-no-print]').forEach((element) => element.remove());
        fallbackClone.querySelectorAll('[style*="transform"]').forEach((element) => {
          const htmlElement = element as HTMLElement;
          htmlElement.style.transform = 'none';
          htmlElement.style.width = '210mm';
          htmlElement.style.maxWidth = '100%';
          htmlElement.style.height = 'auto';
          htmlElement.style.minHeight = 'auto';
        });
        await waitForPdfCaptureLayout(fallbackClone);

        let canvas: HTMLCanvasElement;
        try {
          // html-to-image's internal image-decode step waits on a
          // requestAnimationFrame callback, which browsers suspend
          // indefinitely for a backgrounded/hidden tab — with no rejection,
          // that leaves this permanently stuck on "Generating..." with no
          // error at all. A hard timeout turns that silent hang into a
          // recoverable, distinctly-worded failure.
          canvas = await Promise.race([
            toCanvas(fallbackClone, {
              pixelRatio: 2,
              cacheBust: true,
              backgroundColor: '#ffffff',
              style: {
                transform: 'none',
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('CLIENT_FALLBACK_TIMEOUT')), CLIENT_FALLBACK_TIMEOUT_MS)
            ),
          ]);
        } finally {
          fallbackHost.remove();
        }

        if (isCanvasBlank(canvas)) {
          throw new Error('[PDFDownload] Client-side fallback produced a blank canvas');
        }

        const imgData = canvas.toDataURL('image/png');
        
        // Output to jsPDF (A4)
        const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const a4Height = pdf.internal.pageSize.getHeight();
        
        // Use the user's selected margins, defaulting to 0.75in (19.05mm)
        const displayOpts = useResumeStore.getState().displayOptions;
        const mt = displayOpts?.marginTop ? displayOpts.marginTop * 25.4 : 19.05;
        const mb = displayOpts?.marginBottom ? displayOpts.marginBottom * 25.4 : 19.05;
        
        // Printable area height
        const printableHeight = a4Height - mt - mb;
        
        // Pixel math scaling
        const pxPerMm = canvas.width / pdfWidth;
        const printableHeightPx = printableHeight * pxPerMm;
        
        // Intelligent pixel-scanning engine to find a clean horizontal slice through the canvas 
        // without cutting across text pixels.
        const findSafeBottomPx = (targetBottomPx: number) => {
          try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return targetBottomPx;
            const searchRangePx = Math.floor(25.4 * pxPerMm); // scan upwards up to 1 inch
            for (let y = Math.floor(targetBottomPx); y >= Math.floor(targetBottomPx - searchRangePx) && y > 0; y--) {
              const imgData = ctx.getImageData(0, y, canvas.width, 1).data;
              let isWhite = true;
              // Sample aggressively (every 16th pixel) for blazing fast performance
              for (let i = 0; i < imgData.length; i += 16) {
                // If pixel is visually dark and opaque, this row contains text
                if ((imgData[i] < 250 || imgData[i+1] < 250 || imgData[i+2] < 250) && imgData[i+3] > 10) {
                  isWhite = false;
                  break;
                }
              }
              if (isWhite) return y; // Empty row found!
            }
          } catch {
            // Ignore tainted canvas errors securely
          }
          return targetBottomPx; // Fallback to raw math
        };

        const canvasTotalHeight = canvas.height;
        let currentTopPx = 0;
        let isFirstPage = true;
        
        while (currentTopPx < canvasTotalHeight) {
          if (!isFirstPage) pdf.addPage();
          
          let maxBottomPx = currentTopPx + printableHeightPx;
          let imgYMm = mt;
          
          if (isFirstPage) {
            // Page 1 naturally incorporates the DOM's padding-top, allowing an extended initial printable slice
            maxBottomPx = (mt + printableHeight) * pxPerMm;
            imgYMm = 0; 
          }
          
          if (maxBottomPx > canvasTotalHeight) maxBottomPx = canvasTotalHeight;
          
          let safeBottomPx = maxBottomPx;
          if (maxBottomPx < canvasTotalHeight) {
            safeBottomPx = findSafeBottomPx(maxBottomPx);
          }
          
          const chunkHeightMm = (safeBottomPx - currentTopPx) / pxPerMm;
          const yOffsetMm = currentTopPx / pxPerMm;
          const yImgInPdf = imgYMm - yOffsetMm;
          
          // 'FAST' applies FlateDecode to the bitmap; omitting it makes jsPDF embed
          // raw DeviceRGB (~15MB for one A4 page). The constant alias lets every page
          // reference one shared, compressed image XObject instead of re-embedding it.
          pdf.addImage(imgData, 'PNG', 0, yImgInPdf, pdfWidth, canvasTotalHeight / pxPerMm, 'resume-canvas', 'FAST');
          
          // Mask elements spilling out ABOVE the safe chunk (on pages 2+)
          if (imgYMm > 0) {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pdfWidth, imgYMm, 'F');
          }
          
          // Mask elements spilling out BELOW the safe chunk completely protecting the bottom margin
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, imgYMm + chunkHeightMm, pdfWidth, a4Height - (imgYMm + chunkHeightMm), 'F');
          
          currentTopPx = safeBottomPx;
          isFirstPage = false;
        }
        
        const filename = getSmartFilename(resumeData, selectedTemplate.id, 'pdf');
        const finalFilename = typeof filename === 'string' && filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(finalFilename);

        analytics.trackExportSuccess(selectedTemplate.id, 'pdf');
        requestValueMomentFeedbackPrompt('export_success');
        useResumeStore.getState().setHasDownloaded(true);

      } catch (clientErr) {
        console.error('[PDFDownload] Client-side fallback also failed:', summarizeErrorForConsole(clientErr));
        const isBlankCanvas = clientErr instanceof Error && clientErr.message.includes('blank canvas');
        const isTimeout = clientErr instanceof Error && clientErr.message === 'CLIENT_FALLBACK_TIMEOUT';
        analytics.trackExportFailed(
          selectedTemplate.id,
          'pdf',
          isTimeout ? 'fallback_timeout' : isBlankCanvas ? 'fallback_blank' : 'client_fallback_error'
        );
        setExportError(isTimeout ? exportTimeoutMessage : exportFailureMessage);
      }
    } finally {
      setIsDownloading(false);
    }
  };


  // Download DOCX using docx library (client-side)
  const performDownloadDocx = async () => {
    if (isDownloadingDocx || !hasRealResume || !resumeData) return;

    setIsDownloadingDocx(true);
    setExportError(null);
    analytics.trackExportClicked(selectedTemplate.id, 'docx');
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
        direction: contentDirection,
      });
      if (!blob || blob.size === 0) throw new Error('DOCX export returned an empty file');
      const filename = getSmartFilename(resumeData, selectedTemplate.id, 'docx');
      saveAs(blob, filename);

      analytics.trackExportSuccess(selectedTemplate.id, 'docx');
      requestValueMomentFeedbackPrompt('export_success');
      useResumeStore.getState().setHasDownloaded(true);
    } catch (err) {
      console.error('DOCX Download failed:', summarizeErrorForConsole(err));
      analytics.trackExportFailed(selectedTemplate.id, 'docx', 'client_error');
      setExportError(exportFailureMessage);
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  // Public entry points — gate a guest-preview-origin export behind one
  // charged re-optimize before the real download runs.
  const handleDownloadPdf = async () => {
    if (isGuestPreviewExport) {
      setPendingExportAction('pdf');
      return;
    }
    await performDownloadPdf();
  };

  const handleDownloadDocx = async () => {
    if (isGuestPreviewExport) {
      setPendingExportAction('docx');
      return;
    }
    await performDownloadDocx();
  };

  const handleConfirmReoptimizeAndExport = async () => {
    if (!pendingExportAction) return;
    const action = pendingExportAction;
    setIsReoptimizing(true);
    try {
      const result = await onRequirePaidReoptimize?.();
      if (!result) {
        // The re-run failed or was aborted (e.g. clarification modal
        // dismissed) — the optimize flow has already surfaced its own error;
        // just close this gate without exporting stale/free content.
        return;
      }
      setPendingExportAction(null);
      if (action === 'pdf') {
        await performDownloadPdf();
      } else {
        await performDownloadDocx();
      }
    } catch (err) {
      console.error('[TemplatesSection] Paid re-optimize before export failed:', summarizeErrorForConsole(err));
      setExportError(exportFailureMessage);
    } finally {
      setIsReoptimizing(false);
    }
  };

  const handleSelectTemplate = (template: typeof resumeTemplates[0]) => {
    setSelectedTemplate(template);
    setExportError(null);
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
                onClick={() => setShowAdvancedFormatting((value) => !value)}
                variant="secondary"
                className="border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white"
                aria-pressed={showAdvancedFormatting}
              >
                <SlidersHorizontal className="w-4 h-4 me-2" />
                {showAdvancedFormatting
                  ? t('sections.templates.hideAdvancedFormatting', 'Hide formatting')
                  : t('sections.templates.advancedFormatting', 'Advanced formatting')}
              </GlassButton>

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
                  <><FileText className="w-4 h-4 me-2" />{t('sections.templates.downloadDocx', 'Download DOCX')}</>
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
              <span className="ms-1">{t('sections.templates.mobilePdf', 'PDF file')}</span>
            </GlassButton>

            <GlassButton
              onClick={handleDownloadDocx}
              variant="secondary"
              disabled={!hasRealResume || isDownloadingDocx}
              size="sm"
              className="border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white !px-2.5 !py-1.5 !rounded-lg !text-xs"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="ms-1">{t('sections.templates.mobileDocx', 'DOCX file')}</span>
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

            <GlassButton
              onClick={() => setShowAdvancedFormatting((value) => !value)}
              variant="secondary"
              size="sm"
              className="border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white !px-2.5 !py-1.5 !rounded-lg !text-xs"
              aria-pressed={showAdvancedFormatting}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="ms-1">
                {showAdvancedFormatting
                  ? t('sections.templates.hideAdvancedFormatting', 'Hide formatting')
                  : t('sections.templates.advancedFormatting', 'Advanced formatting')}
              </span>
            </GlassButton>
          </div>

          {showAdvancedFormatting && <KeywordBoldingToggle />}

          {exportError && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
              <p>{exportError}</p>
            </div>
          )}
        </div>

        {/* Zoom Controls Overlay - hidden on mobile (auto-fit), shown on desktop on hover */}
        {showAdvancedFormatting && (
        <div className="hidden lg:flex absolute top-24 end-4 lg:end-6 z-30 flex-col gap-2 bg-white/70 dark:bg-black/70 backdrop-blur-md p-1.5 rounded-lg border border-gray-300/50 dark:border-white/10 shadow-xl lg:opacity-0 lg:hover:opacity-100 lg:group-hover:opacity-100 transition-opacity duration-300">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.96]"
            title={t('common.zoomIn', 'Zoom In')}
            aria-label={t('common.zoomIn', 'Zoom In')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.96]"
            title={t('common.zoomOut', 'Zoom Out')}
            aria-label={t('common.zoomOut', 'Zoom Out')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-gray-300 dark:bg-white/10 my-0.5" />
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.96]"
            title={t('common.resetZoom', 'Reset Zoom')}
            aria-label={t('common.resetZoom', 'Reset Zoom')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        )}


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
          {showAdvancedFormatting && (
          <div className="hidden lg:block flex-shrink-0 p-3 overflow-y-auto">
            <FormattingPanel />
          </div>
          )}

          {/* Resume Preview - Right Side - Fit on screen, use zoom controls */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-6">
            <div className="w-full flex justify-center pb-32 md:pb-20 pt-4">
              {/* Dynamic Scale Wrapper - centered and fit to viewport */}
              <div
                dir={contentDirection}
                className="relative bg-white shadow-2xl rounded-xl overflow-visible ring-1 ring-white/10 transition-transform duration-300 origin-top ease-out mx-auto"
                style={{
                  transform: `scale(${scale})`,
                  width: '210mm',
                  // Container takes scaled width to prevent clipping
                  marginBottom: `calc((1 - ${scale}) * -50%)`,
                }}
              >
                {/* Page Break Indicators Overlay */}
                {showAdvancedFormatting && displayOptions.showPageBreaks && (
                  <PageBreakOverlay contentHeight={A4_PAGE_HEIGHT_PX * 2} />
                )}
                <TemplateRenderer
                  template={selectedTemplate}
                  userData={displayData as unknown as Record<string, unknown>}
                  contentDirection={contentDirection}
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
                  <button
                    type="button"
                    aria-label={t('templates.dragHandle', 'Drag to reposition, or use arrow keys')}
                    className="hidden md:block p-2 text-gray-400 hover:text-gray-900 dark:text-white/50 dark:hover:text-white cursor-grab active:cursor-grabbing touch-none shrink-0"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    onKeyDown={handleDragHandleKeyDown}
                  >
                    <GripHorizontal className="w-4 h-4" />
                  </button>

                  {/* Template Pills */}
                  {activeTemplates.map((template) => {
                    const isSelected = selectedTemplate.id === template.id;
                    return (
                      <button
                        type="button"
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform,scale] duration-200 shrink-0",
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
          <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-200 ease-out">
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

      {/* Guest-preview export/save gate — the applied optimizations came from
          a free preview run; exporting/saving them requires one charged
          re-run first. */}
      <ConfirmActionModal
        isOpen={pendingExportAction !== null}
        onClose={() => setPendingExportAction(null)}
        onConfirm={handleConfirmReoptimizeAndExport}
        feature="optimize"
        isLoading={isReoptimizing}
      />
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
