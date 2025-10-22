// src/features/TemplateGallery.jsx
// Resume template gallery with preview and selection

import { useState, useMemo } from "react";
import { Download, Eye, CheckCircle2, Star, Filter, X } from "lucide-react";
import { resumeTemplates, TEMPLATE_CATEGORIES, calculateTemplateMatch } from "../data/resumeTemplates.js";
import { generateTemplatePreview } from "../utils/templatePreviews.js";
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
          <h3 className="text-lg font-bold text-ink dark:text-white mb-1">
            {template.name}
          </h3>
          <p className="text-sm text-ink-soft dark:text-gray-300">
            {categoryLabels[template.category]}
          </p>
        </div>
        {isSelected && (
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      
      <p className="text-sm text-ink dark:text-gray-200 mb-4">
        {template.description}
      </p>
      
      {/* Preview thumbnail */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 mb-4 h-48 flex items-center justify-center overflow-hidden">
        <img 
          src={generateTemplatePreview(template)} 
          alt={`${template.name} preview`}
          className="w-full h-full object-contain rounded"
        />
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
            <span className="text-ink-soft dark:text-gray-300">Match: </span>
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
  const [exportPreview, setExportPreview] = useState(null);
  
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
  
  const exportTemplate = async (template) => {
    // Generate HTML from template structure
    const html = generateTemplateHTML(template);
    
    // Show preview modal instead of print dialog
    setExportPreview({ template, html });
  };
  
  const handleDownloadPDF = () => {
    if (!exportPreview) return;
    
    const { html } = exportPreview;
    
    // Create a blob with the HTML
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open print dialog
    const printWindow = window.open(url, '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      alert('Please allow pop-ups to download PDF. Check your browser settings.');
      URL.revokeObjectURL(url);
      return;
    }
    
    // Wait for content to load then print
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
          URL.revokeObjectURL(url);
        }, 500);
      }, 500);
    });
    
    setExportPreview(null);
  };
  
  const handleCloseExportPreview = () => {
    setExportPreview(null);
  };
  
  const generateTemplateHTML = (template) => {
    const colorSchemes = {
      emerald: { primary: '#0ea472', secondary: '#075951', accent: '#f4d37d' },
      royal: { primary: '#0f766e', secondary: '#134e4a', accent: '#34d399' },
      classic: { primary: '#1f2937', secondary: '#4b5563', accent: '#6b7280' },
      creative: { primary: '#ec4899', secondary: '#8b5cf6', accent: '#fbbf24' },
      executive: { primary: '#1e3a8a', secondary: '#1e40af', accent: '#dc2626' }
    };
    
    const colors = colorSchemes[template.preview.colorScheme] || colorSchemes.emerald;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${template.name} Template</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Calibri', 'Arial', sans-serif; 
      color: #212529; 
      background: #ffffff; 
      font-size: 11pt;
      line-height: 1.5;
      padding: 0.5in 0.75in;
    }
    @media print {
      body { padding: 0.5in; }
      .no-print { display: none; }
    }
    .header { text-align: center; border-bottom: 3px solid ${colors.primary}; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28pt; font-weight: 700; color: ${colors.primary}; margin-bottom: 6px; }
    .header p { font-size: 10pt; color: #666; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14pt; font-weight: 700; color: ${colors.primary}; border-bottom: 2px solid ${colors.accent}; padding-bottom: 4px; margin-bottom: 12px; }
    .content { font-size: 11pt; color: #333; }
    ul { margin-left: 20px; margin-top: 8px; }
    li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Your Name</h1>
    <p>your.email@example.com | (123) 456-7890 | City, Country</p>
  </div>
  
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="content">
      <p>Add your professional summary here highlighting your key achievements and expertise.</p>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Experience</div>
    <div class="content">
      <p><strong>Job Title | Company Name</strong> <span style="float: right;">2020 - Present</span></p>
      <ul>
        <li>Achievement or responsibility with quantifiable results</li>
        <li>Another achievement demonstrating impact</li>
        <li>Key project or initiative you led</li>
      </ul>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Skills</div>
    <div class="content">
      <p>Skill 1 • Skill 2 • Skill 3 • Skill 4 • Skill 5</p>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Education</div>
    <div class="content">
      <p><strong>Degree Name</strong> - University Name <span style="float: right;">Year</span></p>
    </div>
  </div>
</body>
</html>`;
  };
  
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
              <h3 className="text-lg font-semibold text-ink dark:text-white mb-1">
                Selected: {selectedTemplate.name}
              </h3>
              <p className="text-sm text-ink dark:text-gray-200">
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
      
      {/* Export Preview Modal */}
      {exportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={handleCloseExportPreview}>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-[color:var(--surface-glass)] shadow-[0_24px_68px_rgba(0,0,0,0.4)] backdrop-blur-glass" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] bg-[color:var(--surface-glass-strong)] px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-ink">Template Preview</h2>
                <p className="text-sm text-ink-soft">Review your template before downloading</p>
              </div>
              <button
                onClick={handleCloseExportPreview}
                className="rounded-full p-2 text-ink-soft transition-colors hover:bg-[color:var(--surface-glass)] hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Preview Content */}
            <div className="max-h-[calc(90vh-180px)] overflow-y-auto bg-white p-8">
              <div dangerouslySetInnerHTML={{ __html: exportPreview.html }} />
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[color:var(--glass-border)] bg-[color:var(--surface-glass-strong)] px-6 py-4">
              <p className="text-sm text-ink-soft">
                Click "Download PDF" to open print dialog and save as PDF
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCloseExportPreview}>
                  Cancel
                </Button>
                <Button icon={Download} onClick={handleDownloadPDF}>
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
