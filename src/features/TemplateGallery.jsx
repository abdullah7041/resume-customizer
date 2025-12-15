// src/features/TemplateGallery.jsx
// Resume template gallery with resume.io style split-panel layout

import { useState, useMemo } from "react";
import { saveAs } from "file-saver";
import { Download, ToggleLeft, ToggleRight, Check, Layers, Sparkles, FileText } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES } from "../data/resumeTemplates.js";

import TemplateRenderer from "../components/TemplateRenderer.jsx";
// ResumePDFDocument is now loaded dynamically when needed
import Button from "../components/ui/Button.jsx";
import { mergeResumeData } from "../utils/resumeUtils.js";
import { cn } from "../lib/cn.js";


const categoryLabels = {
  [TEMPLATE_CATEGORIES.MODERN]: "Modern",
  [TEMPLATE_CATEGORIES.CLASSIC]: "Classic",
  [TEMPLATE_CATEGORIES.TECHNICAL]: "Technical"
  // Removed Creative and Executive per user request
};

// Template thumbnail card with miniature preview
const TemplateThumbnail = ({ template, isSelected, onClick, resumeData }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full aspect-[3/4] rounded-lg border-2 transition-all duration-200 overflow-hidden group",
        isSelected
          ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg"
          : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:shadow-md"
      )}
    >
      {/* Miniature Preview */}
      <div className="absolute inset-0 bg-white dark:bg-gray-100 overflow-hidden">
        <div
          className="origin-top-left pointer-events-none select-none"
          style={{
            transform: 'scale(0.22)',
            transformOrigin: 'top left',
            width: '454%',
            height: '454%'
          }}
        >
          <TemplateRenderer template={template} userData={resumeData || {}} />
        </div>
      </div>

      {/* Selected Checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg z-10">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Template Name Overlay */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 p-2 transition-all z-10",
        isSelected ? "bg-emerald-500" : "bg-gradient-to-t from-black/80 to-transparent"
      )}>
        <p className="text-xs font-medium text-white truncate text-center">
          {template.name}
        </p>
      </div>
    </button>
  );
};

export default function TemplateGallery({ resumeData, optimizationData, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(resumeTemplates[0]);
  const [showOptimized, setShowOptimized] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Download PDF using @react-pdf/renderer (loaded dynamically to reduce initial bundle)
  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    const filename = `resume-${selectedTemplate.id}-${new Date().toISOString().split('T')[0]}.pdf`;

    try {
      // Dynamic imports to avoid loading ~1.5MB PDF library until needed
      const [{ pdf }, { default: ResumePDFDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../components/templates/ResumePDFDocument.jsx")
      ]);

      const blob = await pdf(<ResumePDFDocument userData={mergedDownloadData} />).toBlob();
      saveAs(blob, filename);
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

  // Merged data for display
  const displayData = useMemo(() => {
    const original = resumeData || {};
    const merged = mergeResumeData(resumeData, { optimization: optimizationData });

    if (showOptimized && merged) {
      return merged;
    }
    return original;
  }, [resumeData, optimizationData, showOptimized]);

  // Data for PDF download (always use merged)
  const mergedDownloadData = useMemo(() => {
    if (!resumeData) return {};
    const merged = mergeResumeData(resumeData, { optimization: optimizationData });
    return merged || resumeData;
  }, [resumeData, optimizationData]);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] -m-4 sm:-m-5 lg:-m-6">
      {/* Left Panel - Template Selection */}
      <div className="w-2/5 max-w-sm border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50/50 dark:bg-gray-900/30">
        {/* Header with Toggle */}
        <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-4 border-b border-gray-200 dark:border-gray-700 z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Templates</h2>
            </div>
          </div>

          {/* Original/Optimized Toggle */}
          <button
            onClick={() => setShowOptimized(!showOptimized)}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
              showOptimized
                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
            title="Toggle between original and optimized versions"
          >
            {showOptimized ? (
              <>
                <ToggleRight className="w-5 h-5" />
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
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                selectedCategory === "all"
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              All
            </button>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSelectedCategory(value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  selectedCategory === value
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-3">
            {filteredTemplates.map(template => (
              <TemplateThumbnail
                key={template.id}
                template={template}
                isSelected={selectedTemplate?.id === template.id}
                onClick={() => handleSelectTemplate(template)}
                resumeData={resumeData}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800/50">
        {/* Preview Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {selectedTemplate?.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              {showOptimized ? (
                <><Sparkles className="w-4 h-4 text-emerald-500" /> Optimized Version</>
              ) : (
                <><FileText className="w-4 h-4 text-gray-400" /> Original Version</>
              )}
              {selectedTemplate && <span className="ml-1">• {categoryLabels[selectedTemplate.category]}</span>}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleDownloadPdf}
              variant="primary"
              size="sm"
              disabled={!resumeData?.plainText || isDownloading}
            >
              {isDownloading ? "Generating..." : <><Download className="w-4 h-4 mr-2" />
                Download PDF</>}
            </Button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden">
            {selectedTemplate && (
              <TemplateRenderer
                template={selectedTemplate}
                userData={displayData}
              />
            )}
          </div>
        </div>
      </div>


    </div >
  );
}
