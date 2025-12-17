import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { getTemplate, getTemplateConfig } from './registry';

// Icons (inline SVG)
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const FileTextIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PrinterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const EmptyIcon = () => (
  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

interface ResumePreviewProps {
  onExport?: (format: 'styled' | 'ats') => void;
}

export function ResumePreview({ onExport }: ResumePreviewProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const previewRef = useRef<HTMLDivElement>(null);

  const { selectedTemplate, getActiveResume, showOptimized } = useResumeStore();
  const resume = getActiveResume();
  const Template = getTemplate(selectedTemplate);
  const config = getTemplateConfig(selectedTemplate);

  // Empty state
  if (!resume) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-800/50 rounded-xl">
        <div className="text-center text-gray-400">
          <EmptyIcon />
          <p>{isArabic ? 'لم يتم تحميل سيرة ذاتية' : 'No resume loaded'}</p>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !previewRef.current) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${resume.basics.name} - Resume</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; }
            * { box-sizing: border-box; }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body>
          ${previewRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">
            {isArabic ? config.nameAr : config.name}
          </h3>
          <p className="text-sm text-gray-400">
            {showOptimized
              ? isArabic
                ? 'النسخة المحسّنة'
                : 'Optimized Version'
              : isArabic
                ? 'النسخة الأصلية'
                : 'Original Version'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onExport?.('styled')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <DownloadIcon />
            {isArabic ? 'تحميل PDF' : 'Download PDF'}
          </button>
          <button
            onClick={() => onExport?.('ats')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            title={isArabic ? 'تنسيق صديق لـ ATS' : 'ATS-friendly format'}
          >
            <FileTextIcon />
            ATS PDF
          </button>
          <button
            onClick={handlePrint}
            className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            title={isArabic ? 'طباعة' : 'Print'}
          >
            <PrinterIcon />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-900 rounded-xl p-4 overflow-auto max-h-[800px]">
        <div
          ref={previewRef}
          id="resume-preview"
          className="shadow-2xl mx-auto"
          style={{ width: 'fit-content' }}
        >
          <Template resume={resume} />
        </div>
      </div>
    </div>
  );
}




