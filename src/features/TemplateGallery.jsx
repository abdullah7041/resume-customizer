// src/features/TemplateGallery.jsx
// Resume template gallery with preview and selection

import { useState, useMemo, useRef, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { Download, Eye, Filter } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES } from "../data/resumeTemplates.js";

import TemplateRenderer from "../components/TemplateRenderer.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import { mergeResumeData } from "../utils/resumeUtils.js";
import { cn } from "../lib/cn.js";

const categoryLabels = {
  [TEMPLATE_CATEGORIES.MODERN]: "Modern",
  [TEMPLATE_CATEGORIES.CLASSIC]: "Classic",
  [TEMPLATE_CATEGORIES.TECHNICAL]: "Technical",
  [TEMPLATE_CATEGORIES.CREATIVE]: "Creative",
  [TEMPLATE_CATEGORIES.EXECUTIVE]: "Executive"
};

const TemplateCard = ({ template, isSelected, onPreview, onExport, matchScore, resumeData }) => {


  // Determine match badge color
  const matchColor = matchScore >= 80
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : matchScore >= 50
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";

  return (
    <Card className={cn(
      "p-6 flex flex-col h-full transition-all duration-200 hover:shadow-xl",
      isSelected && "ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-ink dark:text-white mb-1">
            {template.name}
          </h3>
          <p className="text-sm text-ink-soft dark:text-gray-300">
            {categoryLabels[template.category]}
          </p>
        </div>
        {matchScore !== null && matchScore !== undefined ? (
          <span className={cn("px-2 py-1 rounded text-xs font-bold", matchColor)}>
            Match: {matchScore}%
          </span>
        ) : (
          <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Not Matched
          </span>
        )}
      </div>

      <p className="text-sm text-ink dark:text-gray-200 mb-4 line-clamp-2">
        {template.description}
      </p>

      {/* Live Preview Thumbnail */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg mb-4 h-64 overflow-hidden relative group border border-gray-200 dark:border-gray-700">
        <div className="absolute inset-0 overflow-hidden">
          <div className="origin-top-left transform scale-[0.4] w-[250%] h-[250%] pointer-events-none select-none bg-white p-8">
            <TemplateRenderer template={template} userData={resumeData || {}} />
          </div>
        </div>
        <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors pointer-events-none" />
      </div>

      <div className="mt-auto flex gap-2">
        <Button
          onClick={() => onPreview(template)}
          variant="outline"
          className="flex-1"
          size="sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
        <Button
          onClick={() => onExport(template)}
          variant="primary"
          className="flex-1"
          size="sm"
        >
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>
    </Card>
  );
};

const TemplatePreview = ({ template, userData, onClose, onUse }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {template.name}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Preview with your data
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onUse(template)} variant="primary">
              Use This Template
            </Button>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <TemplateRenderer template={template} userData={userData} />
        </div>
      </div>
    </div>
  );
};

export default function TemplateGallery({ resumeData, matchAnalysis, optimizationData, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Ref for the print component
  const printComponentRef = useRef(null);
  const [printTemplate, setPrintTemplate] = useState(null);

  // Setup print handler
  const handlePrint = useReactToPrint({
    contentRef: printComponentRef,
    documentTitle: "Resume",
    onAfterPrint: () => setPrintTemplate(null),
  });

  // Trigger print when printTemplate is set
  useEffect(() => {
    if (printTemplate) {
      // Small delay to ensure render
      setTimeout(() => {
        handlePrint();
      }, 100);
    }
  }, [printTemplate, handlePrint]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") {
      return resumeTemplates;
    }
    return resumeTemplates.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  const templatesWithScores = useMemo(() => {
    return filteredTemplates.map(template => ({
      ...template,
      // Use the global match score if available, otherwise 0 or null
      matchScore: matchAnalysis?.score ?? null
    })).sort((a, b) => {
      // Sort by match score if available, otherwise by ATS score
      if (a.matchScore !== null && b.matchScore !== null) {
        return b.matchScore - a.matchScore;
      }
      return b.atsScore - a.atsScore;
    });
  }, [filteredTemplates, matchAnalysis]);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
  };

  const handleClosePreview = () => {
    setPreviewTemplate(null);
  };

  const handleUseTemplate = (template) => {
    handleSelectTemplate(template);
    handleClosePreview();
  };

  const exportTemplate = (template) => {
    // Set the template to be printed, which triggers the useEffect -> handlePrint
    setPrintTemplate(template);
  };

  // Merged data for printing
  const mergedPrintData = useMemo(() => {
    return mergeResumeData(resumeData, { optimization: optimizationData });
  }, [resumeData, optimizationData]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink dark:text-white mb-2">
          Resume Templates
        </h1>
        <p className="text-ink dark:text-gray-200">
          Choose from ATS-optimized templates designed for different industries and roles
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 text-sm text-ink-soft dark:text-gray-300">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filter:</span>
        </div>

        <Button
          onClick={() => setSelectedCategory("all")}
          variant={selectedCategory === "all" ? "primary" : "ghost"}
          size="sm"
        >
          All Templates
        </Button>

        {Object.entries(categoryLabels).map(([value, label]) => (
          <Button
            key={value}
            onClick={() => setSelectedCategory(value)}
            variant={selectedCategory === value ? "primary" : "ghost"}
            size="sm"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templatesWithScores.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplate?.id === template.id}
            onPreview={handlePreview}
            onExport={exportTemplate}
            matchScore={template.matchScore}
            resumeData={resumeData}
          />
        ))}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreview
          template={previewTemplate}
          userData={mergeResumeData(resumeData, { optimization: optimizationData }) || {}}
          onClose={handleClosePreview}
          onUse={handleUseTemplate}
        />
      )}

      {/* Hidden Print Component */}
      <div style={{ display: "none" }}>
        <div ref={printComponentRef}>
          {printTemplate && (
            <TemplateRenderer
              template={printTemplate}
              userData={mergedPrintData || {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}
