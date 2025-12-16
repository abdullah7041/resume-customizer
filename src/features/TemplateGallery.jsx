// src/features/TemplateGallery.jsx
// Resume template gallery with resume.io style split-panel layout

import { useState, useMemo } from "react";
import { saveAs } from "file-saver";
import { Download, ToggleLeft, ToggleRight, Check, Layers, Sparkles, FileText } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES } from "../lib/data/resumeTemplates.ts";

import TemplateRenderer from "../components/templates/TemplateRenderer.tsx";
// ResumePDFDocument is now loaded dynamically when needed
import Button from "../components/ui/Button.jsx";
import { mergeResumeData } from "../lib/utils/resumeUtils.ts";
import { cn } from "../lib/utils/cn.ts";

// Glass card styles matching Header.jsx
const glassCardClass =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)]";

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
        "relative w-full aspect-[3/4] rounded-xl border-2 transition-all duration-300 overflow-hidden group",
        isSelected
          ? "border-emerald-400/50 ring-2 ring-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          : "border-white/10 hover:border-emerald-400/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
      )}
    >
      {/* Miniature Preview */}
      <div className="absolute inset-0 bg-white overflow-hidden">
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
    <div className="flex gap-6 min-h-[600px] p-2">
      {/* Left Panel - Template Selection */}
      <div className={cn(glassCardClass, "w-[340px] flex-shrink-0 flex flex-col")}>
        {/* Header with Toggle */}
        <div className="p-5 space-y-4 border-b border-white/10">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Templates</h2>
          </div>

          {/* Original/Optimized Toggle */}
          <button
            onClick={() => setShowOptimized(!showOptimized)}
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

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-4">
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
      <div className={cn(glassCardClass, "flex-1 flex flex-col")}>
        {/* Preview Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">
              {selectedTemplate?.name}
            </h3>
            <p className="text-sm text-white/60 flex items-center gap-1.5 mt-1">
              {showOptimized ? (
                <><Sparkles className="w-4 h-4 text-emerald-400" /> Optimized Version</>
              ) : (
                <><FileText className="w-4 h-4 text-white/40" /> Original Version</>
              )}
              {selectedTemplate && <span className="ml-1">• {categoryLabels[selectedTemplate.category]}</span>}
            </p>
          </div>

          <Button
            onClick={handleDownloadPdf}
            variant="primary"
            size="sm"
            disabled={!resumeData?.plainText || isDownloading}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            {isDownloading ? "Generating..." : <><Download className="w-4 h-4 mr-2" />Download PDF</>}
          </Button>
        </div>

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



