// src/features/TemplateGallery.jsx
// Resume template gallery with preview and selection

import { useState, useMemo } from "react";
import { FileText, Download, Eye, CheckCircle2, Star, Filter } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES, calculateTemplateMatch } from "../data/resumeTemplates.js";
import TemplateRenderer from "../components/TemplateRenderer.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import { cn } from "../lib/cn.js";

const categoryLabels = {
  [TEMPLATE_CATEGORIES.MODERN]: "Modern",
  [TEMPLATE_CATEGORIES.CLASSIC]: "Classic",
  [TEMPLATE_CATEGORIES.TECHNICAL]: "Technical",
  [TEMPLATE_CATEGORIES.CREATIVE]: "Creative",
  [TEMPLATE_CATEGORIES.EXECUTIVE]: "Executive"
};

const TemplateCard = ({ template, isSelected, onSelect, onPreview, matchScore }) => {
  const atsColor = template.atsScore >= 95 
    ? "text-green-600 dark:text-green-400" 
    : template.atsScore >= 90 
    ? "text-emerald-600 dark:text-emerald-400" 
    : "text-amber-600 dark:text-amber-400";
  
  return (
    <Card className={cn(
      "p-6 cursor-pointer transition-all duration-200 hover:shadow-xl",
      isSelected && "ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            {template.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {categoryLabels[template.category]}
          </p>
        </div>
        {isSelected && (
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        {template.description}
      </p>
      
      {/* Preview thumbnail */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4 h-48 flex items-center justify-center overflow-hidden">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{template.preview.layout} layout</p>
          <p className="capitalize">{template.preview.font}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <span className={cn("text-sm font-semibold", atsColor)}>
            {template.atsScore}% ATS
          </span>
        </div>
        
        {matchScore !== null && (
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-400">Match: </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {matchScore}%
            </span>
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={() => onSelect(template)}
          variant={isSelected ? "primary" : "outline"}
          className="flex-1"
          size="sm"
        >
          {isSelected ? "Selected" : "Use Template"}
        </Button>
        <Button
          onClick={() => onPreview(template)}
          variant="ghost"
          size="sm"
        >
          <Eye className="w-4 h-4" />
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

export default function TemplateGallery({ resumeData, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") {
      return resumeTemplates;
    }
    return resumeTemplates.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);
  
  const templatesWithScores = useMemo(() => {
    return filteredTemplates.map(template => ({
      ...template,
      matchScore: resumeData ? calculateTemplateMatch(template, resumeData) : null
    })).sort((a, b) => {
      // Sort by match score if available, otherwise by ATS score
      if (a.matchScore !== null && b.matchScore !== null) {
        return b.matchScore - a.matchScore;
      }
      return b.atsScore - a.atsScore;
    });
  }, [filteredTemplates, resumeData]);
  
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
    const dataStr = JSON.stringify(template, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.id}-template.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Resume Templates
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Choose from ATS-optimized templates designed for different industries and roles
        </p>
      </div>
      
      {/* Category Filter */}
      <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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
            onSelect={handleSelectTemplate}
            onPreview={handlePreview}
            matchScore={template.matchScore}
            resumeData={resumeData}
          />
        ))}
      </div>
      
      {/* Selected Template Actions */}
      {selectedTemplate && (
        <Card className="mt-6 p-6 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Selected: {selectedTemplate.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ready to apply this template to your resume
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => handlePreview(selectedTemplate)} 
                variant="outline"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button 
                onClick={() => exportTemplate(selectedTemplate)} 
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreview
          template={previewTemplate}
          userData={resumeData || {}}
          onClose={handleClosePreview}
          onUse={handleUseTemplate}
        />
      )}
    </div>
  );
}
