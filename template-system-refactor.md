# Claude Code Instruction: Template System Refactor

## Context
The resume template system has critical issues:
1. "Showing Optimized" toggle doesn't switch between original/optimized content
2. Optimized content doesn't merge with original resume data
3. Templates are image thumbnails instead of live-rendered previews
4. ATS-friendly export is manually styled instead of semantic HTML

## Project Structure Reference
```
resume-customizer/
├── src/
│   ├── components/
│   │   └── templates/        # CREATE THIS
│   ├── lib/
│   │   └── stores/           # Zustand stores
│   └── types/
└── netlify/functions/
```

## Step 1: Create Resume Data Types

Create file: `src/types/resume.ts`
```typescript
export interface ResumeData {
  personalInfo: {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    website?: string;
  };
  summary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications?: Certification[];
  languages?: Language[];
  projects?: Project[];
}

export interface WorkExperience {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string[];
  // Optimization tracking
  originalDescription?: string[];
  isOptimized?: boolean;
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  location?: string;
  graduationDate: string;
  gpa?: string;
  honors?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface Language {
  name: string;
  level: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Beginner';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export type TemplateId = 'modern-professional' | 'classic-traditional' | 'technical-minimal' | 'executive-bold';

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  nameAr: string;
  category: 'modern' | 'classic' | 'technical';
  description: string;
  isAtsOptimized: boolean;
  previewColor: string; // For thumbnail accent
}
```

## Step 2: Create Resume Store with Merge Logic

Create file: `src/lib/stores/resumeStore.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ResumeData, WorkExperience, TemplateId } from '../../types/resume';

interface OptimizationResult {
  sectionId: string;
  sectionType: 'summary' | 'experience' | 'skills';
  original: string | string[];
  optimized: string | string[];
  applied: boolean;
}

interface ResumeState {
  // Data
  originalResume: ResumeData | null;
  optimizations: OptimizationResult[];
  
  // View state
  showOptimized: boolean;
  selectedTemplate: TemplateId;
  
  // Computed
  activeResume: ResumeData | null;
  
  // Actions
  setOriginalResume: (resume: ResumeData) => void;
  addOptimization: (optimization: OptimizationResult) => void;
  applyOptimization: (sectionId: string) => void;
  revertOptimization: (sectionId: string) => void;
  applyAllOptimizations: () => void;
  toggleShowOptimized: () => void;
  setSelectedTemplate: (templateId: TemplateId) => void;
  getActiveResume: () => ResumeData | null;
  clearAll: () => void;
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      originalResume: null,
      optimizations: [],
      showOptimized: true,
      selectedTemplate: 'modern-professional',
      activeResume: null,

      setOriginalResume: (resume) => {
        set({ originalResume: resume });
      },

      addOptimization: (optimization) => {
        set((state) => ({
          optimizations: [
            ...state.optimizations.filter(o => o.sectionId !== optimization.sectionId),
            optimization,
          ],
        }));
      },

      applyOptimization: (sectionId) => {
        set((state) => ({
          optimizations: state.optimizations.map(o =>
            o.sectionId === sectionId ? { ...o, applied: true } : o
          ),
        }));
      },

      revertOptimization: (sectionId) => {
        set((state) => ({
          optimizations: state.optimizations.map(o =>
            o.sectionId === sectionId ? { ...o, applied: false } : o
          ),
        }));
      },

      applyAllOptimizations: () => {
        set((state) => ({
          optimizations: state.optimizations.map(o => ({ ...o, applied: true })),
        }));
      },

      toggleShowOptimized: () => {
        set((state) => ({ showOptimized: !state.showOptimized }));
      },

      setSelectedTemplate: (templateId) => {
        set({ selectedTemplate: templateId });
      },

      getActiveResume: () => {
        const state = get();
        if (!state.originalResume) return null;
        if (!state.showOptimized) return state.originalResume;

        // Merge applied optimizations into resume
        const merged = JSON.parse(JSON.stringify(state.originalResume)) as ResumeData;

        for (const opt of state.optimizations) {
          if (!opt.applied) continue;

          switch (opt.sectionType) {
            case 'summary':
              merged.summary = opt.optimized as string;
              break;

            case 'experience':
              const expIndex = merged.experience.findIndex(e => e.id === opt.sectionId);
              if (expIndex !== -1) {
                merged.experience[expIndex].description = opt.optimized as string[];
                merged.experience[expIndex].isOptimized = true;
                merged.experience[expIndex].originalDescription = opt.original as string[];
              }
              break;

            case 'skills':
              merged.skills = opt.optimized as string[];
              break;
          }
        }

        return merged;
      },

      clearAll: () => {
        set({
          originalResume: null,
          optimizations: [],
          showOptimized: true,
        });
      },
    }),
    {
      name: 'resume-storage',
      partialize: (state) => ({
        originalResume: state.originalResume,
        optimizations: state.optimizations,
        selectedTemplate: state.selectedTemplate,
      }),
    }
  )
);
```

## Step 3: Create Template Components

### Base Template Interface
Create file: `src/components/templates/BaseTemplate.tsx`
```typescript
import { ResumeData } from '../../types/resume';

export interface TemplateProps {
  resume: ResumeData;
  isAtsMode?: boolean;
  scale?: number; // For thumbnail preview
}

export interface TemplateComponent extends React.FC<TemplateProps> {
  displayName: string;
}
```

### Modern Professional Template
Create file: `src/components/templates/ModernProfessional.tsx`
```typescript
import { TemplateProps } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';

export function ModernProfessional({ resume, isAtsMode = false, scale = 1 }: TemplateProps) {
  const { isRTL } = useDirection();

  // ATS mode = pure semantic HTML, no styling
  if (isAtsMode) {
    return <ATSVersion resume={resume} />;
  }

  return (
    <div 
      className="bg-white text-gray-900 font-sans"
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: '210mm', // A4 width
        minHeight: '297mm', // A4 height
        padding: '20mm',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className="border-b-2 border-emerald-600 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          {resume.personalInfo.name}
        </h1>
        <p className="text-lg text-emerald-600 font-medium mb-3">
          {resume.personalInfo.title}
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {resume.personalInfo.email && (
            <span>{resume.personalInfo.email}</span>
          )}
          {resume.personalInfo.phone && (
            <span>{resume.personalInfo.phone}</span>
          )}
          {resume.personalInfo.location && (
            <span>{resume.personalInfo.location}</span>
          )}
          {resume.personalInfo.linkedin && (
            <span>{resume.personalInfo.linkedin}</span>
          )}
        </div>
      </header>

      {/* Summary */}
      {resume.summary && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-2 border-b border-gray-200 pb-1">
            Professional Summary
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {resume.summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {resume.experience.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            Work Experience
          </h2>
          <div className="space-y-4">
            {resume.experience.map((exp) => (
              <div key={exp.id} className="relative">
                {exp.isOptimized && (
                  <span className="absolute -left-4 top-0 w-2 h-2 bg-emerald-500 rounded-full" title="Optimized" />
                )}
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="font-semibold text-gray-900">{exp.title}</h3>
                    <p className="text-emerald-600">{exp.company}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                <ul className="list-disc list-inside text-gray-700 space-y-1 mt-2">
                  {exp.description.map((item, i) => (
                    <li key={i} className="text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            Education
          </h2>
          <div className="space-y-3">
            {resume.education.map((edu) => (
              <div key={edu.id} className="flex justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                  <p className="text-gray-600">{edu.institution}</p>
                </div>
                <span className="text-sm text-gray-500">{edu.graduationDate}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill, i) => (
              <span 
                key={i}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Languages */}
      {resume.languages && resume.languages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            Languages
          </h2>
          <div className="flex flex-wrap gap-4">
            {resume.languages.map((lang, i) => (
              <span key={i} className="text-gray-700">
                <strong>{lang.name}</strong>: {lang.level}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ATS-Optimized Version: Pure semantic HTML, no styling
function ATSVersion({ resume }: { resume: ResumeData }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt', lineHeight: '1.4' }}>
      {/* Name - Simple, clear */}
      <h1 style={{ fontSize: '18pt', marginBottom: '4pt' }}>{resume.personalInfo.name}</h1>
      <p style={{ marginBottom: '8pt' }}>{resume.personalInfo.title}</p>
      
      {/* Contact - One line, pipe separated (ATS standard) */}
      <p style={{ marginBottom: '16pt' }}>
        {[
          resume.personalInfo.email,
          resume.personalInfo.phone,
          resume.personalInfo.location,
          resume.personalInfo.linkedin,
        ].filter(Boolean).join(' | ')}
      </p>

      {/* Summary */}
      {resume.summary && (
        <>
          <h2 style={{ fontSize: '12pt', borderBottom: '1px solid #000', marginBottom: '8pt' }}>
            PROFESSIONAL SUMMARY
          </h2>
          <p style={{ marginBottom: '16pt' }}>{resume.summary}</p>
        </>
      )}

      {/* Experience */}
      <h2 style={{ fontSize: '12pt', borderBottom: '1px solid #000', marginBottom: '8pt' }}>
        WORK EXPERIENCE
      </h2>
      {resume.experience.map((exp) => (
        <div key={exp.id} style={{ marginBottom: '12pt' }}>
          <p style={{ fontWeight: 'bold' }}>
            {exp.title} | {exp.company}
          </p>
          <p style={{ fontStyle: 'italic', marginBottom: '4pt' }}>
            {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
          </p>
          <ul style={{ marginLeft: '20pt', marginTop: '4pt' }}>
            {exp.description.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}

      {/* Education */}
      <h2 style={{ fontSize: '12pt', borderBottom: '1px solid #000', marginBottom: '8pt' }}>
        EDUCATION
      </h2>
      {resume.education.map((edu) => (
        <p key={edu.id} style={{ marginBottom: '8pt' }}>
          <strong>{edu.degree}</strong> | {edu.institution} | {edu.graduationDate}
        </p>
      ))}

      {/* Skills - Comma separated (ATS can parse this) */}
      <h2 style={{ fontSize: '12pt', borderBottom: '1px solid #000', marginBottom: '8pt' }}>
        SKILLS
      </h2>
      <p>{resume.skills.join(', ')}</p>
    </div>
  );
}

ModernProfessional.displayName = 'Modern Professional';
```

### Classic Traditional Template
Create file: `src/components/templates/ClassicTraditional.tsx`
```typescript
import { TemplateProps } from './BaseTemplate';

export function ClassicTraditional({ resume, isAtsMode = false, scale = 1 }: TemplateProps) {
  if (isAtsMode) {
    // Use same ATS format as Modern - ATS doesn't care about styling
    return <ATSVersion resume={resume} />;
  }

  return (
    <div 
      className="bg-white text-gray-900 font-serif"
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: '210mm',
        minHeight: '297mm',
        padding: '25mm 20mm',
      }}
    >
      {/* Centered Header */}
      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-widest mb-2">
          {resume.personalInfo.name}
        </h1>
        <div className="w-16 h-0.5 bg-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 italic mb-2">
          {resume.personalInfo.title}
        </p>
        <p className="text-sm text-gray-500">
          {[
            resume.personalInfo.email,
            resume.personalInfo.phone,
            resume.personalInfo.location,
          ].filter(Boolean).join(' • ')}
        </p>
      </header>

      {/* Two-column layout for classic look */}
      <div className="grid grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="col-span-1 space-y-6">
          {/* Skills */}
          {resume.skills.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Expertise
              </h2>
              <ul className="space-y-1 text-sm text-gray-700">
                {resume.skills.slice(0, 10).map((skill, i) => (
                  <li key={i}>• {skill}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Education */}
          {resume.education.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Education
              </h2>
              {resume.education.map((edu) => (
                <div key={edu.id} className="mb-3 text-sm">
                  <p className="font-semibold text-gray-900">{edu.degree}</p>
                  <p className="text-gray-600">{edu.institution}</p>
                  <p className="text-gray-500 text-xs">{edu.graduationDate}</p>
                </div>
              ))}
            </section>
          )}

          {/* Languages */}
          {resume.languages && resume.languages.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Languages
              </h2>
              <ul className="space-y-1 text-sm text-gray-700">
                {resume.languages.map((lang, i) => (
                  <li key={i}>{lang.name} — {lang.level}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Main Content */}
        <div className="col-span-2">
          {/* Summary */}
          {resume.summary && (
            <section className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                Professional Profile
              </h2>
              <p className="text-gray-700 leading-relaxed text-sm">
                {resume.summary}
              </p>
            </section>
          )}

          {/* Experience */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
              Professional Experience
            </h2>
            <div className="space-y-5">
              {resume.experience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900">{exp.title}</h3>
                    <span className="text-xs text-gray-500">
                      {exp.startDate} – {exp.current ? 'Present' : exp.endDate}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 italic mb-2">{exp.company}</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {exp.description.map((item, i) => (
                      <li key={i} className="pl-4 relative before:content-['–'] before:absolute before:left-0">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Same ATS version for all templates
function ATSVersion({ resume }: { resume: any }) {
  // ... (same as ModernProfessional ATSVersion)
}

ClassicTraditional.displayName = 'Classic Traditional';
```

### Template Registry
Create file: `src/components/templates/index.ts`
```typescript
import { TemplateComponent } from './BaseTemplate';
import { ModernProfessional } from './ModernProfessional';
import { ClassicTraditional } from './ClassicTraditional';
import { TemplateConfig, TemplateId } from '../../types/resume';

export const TEMPLATES: Record<TemplateId, TemplateComponent> = {
  'modern-professional': ModernProfessional,
  'classic-traditional': ClassicTraditional,
  'technical-minimal': ModernProfessional, // TODO: Create separate
  'executive-bold': ClassicTraditional, // TODO: Create separate
};

export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    id: 'modern-professional',
    name: 'Modern Professional',
    nameAr: 'احترافي عصري',
    category: 'modern',
    description: 'Clean, contemporary design with accent colors',
    isAtsOptimized: true,
    previewColor: '#10b981', // emerald
  },
  {
    id: 'classic-traditional',
    name: 'Classic Traditional',
    nameAr: 'كلاسيكي تقليدي',
    category: 'classic',
    description: 'Timeless two-column layout with elegant typography',
    isAtsOptimized: true,
    previewColor: '#6b7280', // gray
  },
  {
    id: 'technical-minimal',
    name: 'Technical Minimal',
    nameAr: 'تقني بسيط',
    category: 'technical',
    description: 'Stripped-down format for technical roles',
    isAtsOptimized: true,
    previewColor: '#3b82f6', // blue
  },
  {
    id: 'executive-bold',
    name: 'Executive Bold',
    nameAr: 'تنفيذي جريء',
    category: 'classic',
    description: 'Commanding presence for senior positions',
    isAtsOptimized: true,
    previewColor: '#1f2937', // dark gray
  },
];

export function getTemplate(id: TemplateId): TemplateComponent {
  return TEMPLATES[id] || TEMPLATES['modern-professional'];
}

export function getTemplateConfig(id: TemplateId): TemplateConfig {
  return TEMPLATE_CONFIGS.find(t => t.id === id) || TEMPLATE_CONFIGS[0];
}
```

## Step 4: Create Template Selector Component

Create file: `src/components/templates/TemplateSelector.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { TEMPLATE_CONFIGS, TEMPLATES } from './index';
import { TemplateId } from '../../types/resume';
import { Check, Eye, EyeOff } from 'lucide-react';

// Sample data for thumbnail preview
const SAMPLE_RESUME = {
  personalInfo: {
    name: 'Your Name',
    title: 'Your Title',
    email: 'email@example.com',
    phone: '+966 5X XXX XXXX',
    location: 'Riyadh, SA',
  },
  summary: 'Professional summary preview text...',
  experience: [{
    id: '1',
    title: 'Job Title',
    company: 'Company Name',
    startDate: '2020',
    current: true,
    description: ['Key achievement one', 'Key achievement two'],
  }],
  education: [{
    id: '1',
    degree: 'Degree Name',
    institution: 'University',
    graduationDate: '2020',
  }],
  skills: ['Skill 1', 'Skill 2', 'Skill 3'],
  languages: [{ name: 'English', level: 'Fluent' as const }],
};

interface TemplateSelectorProps {
  onSelect?: (templateId: TemplateId) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const { 
    selectedTemplate, 
    setSelectedTemplate,
    showOptimized,
    toggleShowOptimized,
    getActiveResume,
  } = useResumeStore();

  const [category, setCategory] = useState<'all' | 'modern' | 'classic' | 'technical'>('all');

  const filteredTemplates = TEMPLATE_CONFIGS.filter(
    t => category === 'all' || t.category === category
  );

  const handleSelect = (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    onSelect?.(templateId);
  };

  return (
    <div className="space-y-6">
      {/* Optimized Toggle */}
      <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
        <div className="flex items-center gap-3">
          {showOptimized ? (
            <Eye className="w-5 h-5 text-emerald-400" />
          ) : (
            <EyeOff className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <p className="font-medium text-white">
              {showOptimized 
                ? (isArabic ? 'عرض المحسّن' : 'Showing Optimized')
                : (isArabic ? 'عرض الأصلي' : 'Showing Original')
              }
            </p>
            <p className="text-sm text-gray-400">
              {showOptimized
                ? (isArabic ? 'التغييرات المطبقة مرئية' : 'Applied changes are visible')
                : (isArabic ? 'إصدار السيرة الذاتية الأصلي' : 'Original resume version')
              }
            </p>
          </div>
        </div>
        <button
          onClick={toggleShowOptimized}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            showOptimized ? 'bg-emerald-600' : 'bg-gray-600'
          }`}
        >
          <span 
            className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
              showOptimized ? 'left-8' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2">
        {(['all', 'modern', 'classic', 'technical'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              category === cat
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {cat === 'all' ? (isArabic ? 'الكل' : 'All') :
             cat === 'modern' ? (isArabic ? 'عصري' : 'Modern') :
             cat === 'classic' ? (isArabic ? 'كلاسيكي' : 'Classic') :
             (isArabic ? 'تقني' : 'Technical')}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredTemplates.map((config) => {
          const Template = TEMPLATES[config.id];
          const isSelected = selectedTemplate === config.id;
          
          return (
            <button
              key={config.id}
              onClick={() => handleSelect(config.id)}
              className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                isSelected 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50' 
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              {/* Live Template Preview (scaled down) */}
              <div className="aspect-[210/297] bg-white overflow-hidden">
                <div className="w-[210mm] h-[297mm] origin-top-left" style={{ transform: 'scale(0.15)' }}>
                  <Template resume={SAMPLE_RESUME as any} scale={1} />
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Label */}
              <div 
                className="absolute bottom-0 inset-x-0 py-2 px-3 text-center text-sm font-medium text-white"
                style={{ backgroundColor: config.previewColor }}
              >
                {isArabic ? config.nameAr : config.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

## Step 5: Create Resume Preview Component

Create file: `src/components/templates/ResumePreview.tsx`
```typescript
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { getTemplate, getTemplateConfig } from './index';
import { Download, FileText, Printer } from 'lucide-react';

interface ResumePreviewProps {
  onExport?: (format: 'styled' | 'ats') => void;
}

export function ResumePreview({ onExport }: ResumePreviewProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const previewRef = useRef<HTMLDivElement>(null);

  const { selectedTemplate, getActiveResume, showOptimized } = useResumeStore();
  const resume = getActiveResume();
  const Template = getTemplate(selectedTemplate);
  const config = getTemplateConfig(selectedTemplate);

  if (!resume) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-800/50 rounded-xl">
        <div className="text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
          <title>${resume.personalInfo.name} - Resume</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${previewRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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
              ? (isArabic ? 'النسخة المحسّنة' : 'Optimized Version')
              : (isArabic ? 'النسخة الأصلية' : 'Original Version')
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onExport?.('styled')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            {isArabic ? 'تحميل PDF' : 'Download PDF'}
          </button>
          <button
            onClick={() => onExport?.('ats')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {isArabic ? 'ATS PDF' : 'ATS PDF'}
          </button>
          <button
            onClick={handlePrint}
            className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-900 rounded-xl p-4 overflow-auto max-h-[800px]">
        <div 
          ref={previewRef}
          className="shadow-2xl mx-auto"
          style={{ width: 'fit-content' }}
        >
          <Template resume={resume} />
        </div>
      </div>
    </div>
  );
}
```

## Step 6: Create PDF Export Utility (ATS-Compliant)

Create file: `src/lib/utils/pdfExport.ts`
```typescript
import { ResumeData } from '../../types/resume';

/**
 * Generate ATS-friendly PDF using browser print
 * This approach ensures maximum ATS compatibility by using
 * semantic HTML that prints cleanly to PDF
 */
export async function exportToPdf(
  resume: ResumeData,
  options: {
    format: 'styled' | 'ats';
    templateHtml?: string;
  }
): Promise<void> {
  const { format, templateHtml } = options;

  // For ATS format, generate clean semantic HTML
  const html = format === 'ats' 
    ? generateAtsHtml(resume)
    : templateHtml || generateAtsHtml(resume);

  // Create print-ready document
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for PDF export.');
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${resume.personalInfo.name} - Resume</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 0;
          }
          h1 { font-size: 18pt; margin: 0 0 4pt 0; }
          h2 { 
            font-size: 12pt; 
            border-bottom: 1pt solid #000; 
            padding-bottom: 2pt;
            margin: 16pt 0 8pt 0;
          }
          h3 { font-size: 11pt; margin: 0 0 2pt 0; }
          p { margin: 0 0 4pt 0; }
          ul { margin: 4pt 0 0 0; padding-left: 20pt; }
          li { margin-bottom: 2pt; }
          .header-info { margin-bottom: 8pt; }
          .job-header { display: flex; justify-content: space-between; }
          .job-company { font-style: italic; margin-bottom: 4pt; }
          .job-dates { font-size: 10pt; color: #444; }
          .skills { margin-top: 4pt; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);

  printWindow.document.close();
  
  // Wait for content to load, then trigger print
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

/**
 * Generate clean, ATS-optimized HTML
 * Following resume.io and industry best practices:
 * - Simple, semantic HTML
 * - No tables for layout
 * - No images or graphics
 * - Standard section headers
 * - Consistent formatting
 */
function generateAtsHtml(resume: ResumeData): string {
  const contactInfo = [
    resume.personalInfo.email,
    resume.personalInfo.phone,
    resume.personalInfo.location,
    resume.personalInfo.linkedin,
  ].filter(Boolean).join(' | ');

  const experienceHtml = resume.experience.map(exp => `
    <div style="margin-bottom: 12pt;">
      <div class="job-header">
        <h3>${exp.title}</h3>
        <span class="job-dates">${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || ''}</span>
      </div>
      <p class="job-company">${exp.company}${exp.location ? `, ${exp.location}` : ''}</p>
      <ul>
        ${exp.description.map(d => `<li>${d}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  const educationHtml = resume.education.map(edu => `
    <p>
      <strong>${edu.degree}</strong> | ${edu.institution} | ${edu.graduationDate}
      ${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}
    </p>
  `).join('');

  const skillsHtml = resume.skills.join(', ');

  const languagesHtml = resume.languages 
    ? resume.languages.map(l => `${l.name} (${l.level})`).join(', ')
    : '';

  return `
    <h1>${resume.personalInfo.name}</h1>
    <p><strong>${resume.personalInfo.title}</strong></p>
    <p class="header-info">${contactInfo}</p>

    ${resume.summary ? `
      <h2>PROFESSIONAL SUMMARY</h2>
      <p>${resume.summary}</p>
    ` : ''}

    <h2>WORK EXPERIENCE</h2>
    ${experienceHtml}

    <h2>EDUCATION</h2>
    ${educationHtml}

    <h2>SKILLS</h2>
    <p class="skills">${skillsHtml}</p>

    ${languagesHtml ? `
      <h2>LANGUAGES</h2>
      <p>${languagesHtml}</p>
    ` : ''}
  `;
}
```

## Step 7: Integration - Update Main Template Page

Update your existing templates page to use the new components:

```typescript
// src/pages/Templates.tsx or wherever your template section lives

import { TemplateSelector } from '../components/templates/TemplateSelector';
import { ResumePreview } from '../components/templates/ResumePreview';
import { exportToPdf } from '../lib/utils/pdfExport';
import { useResumeStore } from '../lib/stores/resumeStore';

export function TemplatesPage() {
  const { getActiveResume, selectedTemplate } = useResumeStore();

  const handleExport = async (format: 'styled' | 'ats') => {
    const resume = getActiveResume();
    if (!resume) return;

    if (format === 'ats') {
      await exportToPdf(resume, { format: 'ats' });
    } else {
      // For styled, capture the rendered template
      const templateElement = document.getElementById('resume-preview');
      await exportToPdf(resume, { 
        format: 'styled',
        templateHtml: templateElement?.innerHTML,
      });
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 p-6">
      {/* Template Selector - Left Panel */}
      <div className="col-span-4 bg-gray-800/50 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Templates</h2>
        <TemplateSelector />
      </div>

      {/* Resume Preview - Right Panel */}
      <div className="col-span-8">
        <ResumePreview onExport={handleExport} />
      </div>
    </div>
  );
}
```

## Summary: Files to Create

1. `src/types/resume.ts` - TypeScript types
2. `src/lib/stores/resumeStore.ts` - Zustand store with merge logic
3. `src/components/templates/BaseTemplate.tsx` - Template interface
4. `src/components/templates/ModernProfessional.tsx` - First template
5. `src/components/templates/ClassicTraditional.tsx` - Second template
6. `src/components/templates/index.ts` - Template registry
7. `src/components/templates/TemplateSelector.tsx` - Selection UI
8. `src/components/templates/ResumePreview.tsx` - Preview with export
9. `src/lib/utils/pdfExport.ts` - ATS-compliant PDF generation

## Key Fixes Implemented

1. **Toggle now works**: Connected to Zustand store, affects `getActiveResume()`
2. **Merge logic**: `getActiveResume()` combines original + applied optimizations
3. **Live template previews**: Actual React components scaled down, not images
4. **ATS-friendly export**: Pure semantic HTML, prints to PDF via browser

## Dependencies

```bash
npm install zustand
```

No additional dependencies needed - using browser print API for PDF generation (same approach as resume.io).
