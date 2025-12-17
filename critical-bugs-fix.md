# Claude Code Instruction: Fix Critical Bugs

## Overview
Fix 4 critical bugs:
1. PDF download font error
2. Before/After toggle not working
3. Optimize section showing no content
4. Templates showing mock data instead of user resume

---

## Bug 1: PDF Download Font Error

**Error:** `Could not resolve font for Inter, fontWeight 400, fontStyle italic`

**Cause:** @react-pdf/renderer requires explicit font registration. Inter italic wasn't registered.

**Fix:** Update `src/components/templates/ResumePDFDocument.tsx`

```typescript
// src/components/templates/ResumePDFDocument.tsx
import { Document, Page, Text, View, StyleSheet, Font, Link } from '@react-pdf/renderer';
import { ResumeData } from '../../types/resume';

// Register Inter font family with all variants needed
// Using Google Fonts CDN for reliability
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 500,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 700,
    },
  ],
});

// ALTERNATIVE: Use system fonts instead (more reliable, no network dependency)
// Uncomment this and comment out the Font.register above if you want system fonts
/*
Font.register({
  family: 'Inter',
  fonts: [
    { src: '/fonts/Inter-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Inter-Medium.ttf', fontWeight: 500 },
    { src: '/fonts/Inter-SemiBold.ttf', fontWeight: 600 },
    { src: '/fonts/Inter-Bold.ttf', fontWeight: 700 },
  ],
});
*/

// Disable hyphenation (can cause issues)
Font.registerHyphenationCallback(word => [word]);

// ATS-friendly styles - simple, clean, parseable
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    padding: 40,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  // Header section
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 15,
  },
  name: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
    color: '#111827',
  },
  title: {
    fontSize: 12,
    fontWeight: 500,
    color: '#059669', // Emerald
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contactItem: {
    fontSize: 9,
    color: '#6b7280',
  },
  contactSeparator: {
    fontSize: 9,
    color: '#d1d5db',
    marginHorizontal: 4,
  },
  // Section styles
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
    marginBottom: 8,
  },
  // Summary
  summary: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#374151',
  },
  // Experience
  experienceItem: {
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  jobTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#111827',
  },
  jobDates: {
    fontSize: 9,
    color: '#6b7280',
  },
  jobCompany: {
    fontSize: 10,
    color: '#059669',
    marginBottom: 4,
  },
  bulletList: {
    paddingLeft: 12,
  },
  bulletItem: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#374151',
    marginBottom: 2,
  },
  bullet: {
    marginRight: 6,
  },
  // Education
  educationItem: {
    marginBottom: 8,
  },
  degree: {
    fontSize: 10,
    fontWeight: 600,
    color: '#111827',
  },
  institution: {
    fontSize: 9,
    color: '#6b7280',
  },
  // Skills
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillTag: {
    fontSize: 9,
    backgroundColor: '#f3f4f6',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    color: '#374151',
  },
  // Languages
  languageItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  languageName: {
    fontSize: 10,
    fontWeight: 500,
    color: '#111827',
    marginRight: 8,
  },
  languageLevel: {
    fontSize: 9,
    color: '#6b7280',
  },
  // Links
  link: {
    color: '#059669',
    textDecoration: 'none',
  },
});

interface ResumePDFDocumentProps {
  resume: ResumeData;
  templateId?: string;
}

export function ResumePDFDocument({ resume }: ResumePDFDocumentProps) {
  const { personalInfo, summary, experience, education, skills, languages, certifications } = resume;

  // Format contact info
  const contactItems = [
    personalInfo.email,
    personalInfo.phone,
    personalInfo.location,
  ].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{personalInfo.name}</Text>
          {personalInfo.title && (
            <Text style={styles.title}>{personalInfo.title}</Text>
          )}
          <View style={styles.contactRow}>
            {contactItems.map((item, index) => (
              <View key={index} style={{ flexDirection: 'row' }}>
                <Text style={styles.contactItem}>{item}</Text>
                {index < contactItems.length - 1 && (
                  <Text style={styles.contactSeparator}>|</Text>
                )}
              </View>
            ))}
          </View>
          {/* Links */}
          {(personalInfo.linkedin || personalInfo.website) && (
            <View style={[styles.contactRow, { marginTop: 4 }]}>
              {personalInfo.linkedin && (
                <Link src={personalInfo.linkedin} style={[styles.contactItem, styles.link]}>
                  {personalInfo.linkedin.replace('https://', '')}
                </Link>
              )}
              {personalInfo.website && (
                <Link src={personalInfo.website} style={[styles.contactItem, styles.link]}>
                  {personalInfo.website.replace('https://', '')}
                </Link>
              )}
            </View>
          )}
        </View>

        {/* Summary */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{summary}</Text>
          </View>
        )}

        {/* Experience */}
        {experience && experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {experience.map((exp, index) => (
              <View key={exp.id || index} style={styles.experienceItem}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobTitle}>{exp.title}</Text>
                  <Text style={styles.jobDates}>
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </Text>
                </View>
                <Text style={styles.jobCompany}>
                  {exp.company}{exp.location ? `, ${exp.location}` : ''}
                </Text>
                {exp.description && exp.description.length > 0 && (
                  <View style={styles.bulletList}>
                    {exp.description.map((item, i) => (
                      <View key={i} style={{ flexDirection: 'row' }}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bulletItem}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {education && education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, index) => (
              <View key={edu.id || index} style={styles.educationItem}>
                <View style={styles.jobHeader}>
                  <Text style={styles.degree}>{edu.degree}</Text>
                  <Text style={styles.jobDates}>{edu.graduationDate}</Text>
                </View>
                <Text style={styles.institution}>
                  {edu.institution}{edu.location ? `, ${edu.location}` : ''}
                  {edu.gpa ? ` | GPA: ${edu.gpa}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {skills && skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsContainer}>
              {skills.map((skill, index) => (
                <Text key={index} style={styles.skillTag}>{skill}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Certifications */}
        {certifications && certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certifications.map((cert, index) => (
              <View key={cert.id || index} style={styles.educationItem}>
                <Text style={styles.degree}>{cert.name}</Text>
                <Text style={styles.institution}>
                  {cert.issuer}{cert.date ? ` | ${cert.date}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Languages */}
        {languages && languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            {languages.map((lang, index) => (
              <View key={index} style={styles.languageItem}>
                <Text style={styles.languageName}>{lang.name}:</Text>
                <Text style={styles.languageLevel}>{lang.level}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export default ResumePDFDocument;
```

---

## Bug 2: Before/After Toggle Not Working

**Cause:** The toggle state in `resumeStore` isn't connected to the components.

**Fix:** Update `src/lib/stores/resumeStore.ts` to ensure proper state management:

```typescript
// src/lib/stores/resumeStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ResumeData, WorkExperience } from '../../types/resume';

export interface OptimizationResult {
  sectionId: string;
  sectionType: 'summary' | 'experience' | 'skills' | 'headline';
  original: string | string[];
  optimized: string | string[];
  applied: boolean;
}

interface KeywordSuggestion {
  keyword: string;
  category: 'add' | 'keep' | 'deemphasize';
}

interface ResumeState {
  // Core data
  originalResume: ResumeData | null;
  parsedResumeText: string | null;
  
  // Optimizations
  optimizations: OptimizationResult[];
  keywordSuggestions: KeywordSuggestion[];
  
  // View state
  showOptimized: boolean;
  selectedTemplate: string;
  
  // Actions
  setOriginalResume: (resume: ResumeData) => void;
  setParsedResumeText: (text: string) => void;
  addOptimization: (optimization: OptimizationResult) => void;
  setOptimizations: (optimizations: OptimizationResult[]) => void;
  applyOptimization: (sectionId: string) => void;
  revertOptimization: (sectionId: string) => void;
  applyAllOptimizations: () => void;
  toggleShowOptimized: () => void;
  setShowOptimized: (show: boolean) => void;
  setSelectedTemplate: (templateId: string) => void;
  setKeywordSuggestions: (suggestions: KeywordSuggestion[]) => void;
  getActiveResume: () => ResumeData | null;
  clearAll: () => void;
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      // Initial state
      originalResume: null,
      parsedResumeText: null,
      optimizations: [],
      keywordSuggestions: [],
      showOptimized: false, // Start with original
      selectedTemplate: 'modern-professional',

      // Actions
      setOriginalResume: (resume) => {
        console.log('[ResumeStore] Setting original resume:', resume?.personalInfo?.name);
        set({ originalResume: resume });
      },

      setParsedResumeText: (text) => {
        console.log('[ResumeStore] Setting parsed text, length:', text?.length);
        set({ parsedResumeText: text });
      },

      addOptimization: (optimization) => {
        console.log('[ResumeStore] Adding optimization:', optimization.sectionId);
        set((state) => ({
          optimizations: [
            ...state.optimizations.filter(o => o.sectionId !== optimization.sectionId),
            optimization,
          ],
        }));
      },

      setOptimizations: (optimizations) => {
        console.log('[ResumeStore] Setting optimizations:', optimizations.length);
        set({ optimizations });
      },

      applyOptimization: (sectionId) => {
        console.log('[ResumeStore] Applying optimization:', sectionId);
        set((state) => ({
          optimizations: state.optimizations.map(o =>
            o.sectionId === sectionId ? { ...o, applied: true } : o
          ),
        }));
      },

      revertOptimization: (sectionId) => {
        console.log('[ResumeStore] Reverting optimization:', sectionId);
        set((state) => ({
          optimizations: state.optimizations.map(o =>
            o.sectionId === sectionId ? { ...o, applied: false } : o
          ),
        }));
      },

      applyAllOptimizations: () => {
        console.log('[ResumeStore] Applying all optimizations');
        set((state) => ({
          optimizations: state.optimizations.map(o => ({ ...o, applied: true })),
          showOptimized: true,
        }));
      },

      toggleShowOptimized: () => {
        const current = get().showOptimized;
        console.log('[ResumeStore] Toggling showOptimized:', !current);
        set({ showOptimized: !current });
      },

      setShowOptimized: (show) => {
        console.log('[ResumeStore] Setting showOptimized:', show);
        set({ showOptimized: show });
      },

      setSelectedTemplate: (templateId) => {
        console.log('[ResumeStore] Setting template:', templateId);
        set({ selectedTemplate: templateId });
      },

      setKeywordSuggestions: (suggestions) => {
        console.log('[ResumeStore] Setting keyword suggestions:', suggestions.length);
        set({ keywordSuggestions: suggestions });
      },

      getActiveResume: () => {
        const state = get();
        if (!state.originalResume) {
          console.log('[ResumeStore] getActiveResume: No original resume');
          return null;
        }
        
        // If not showing optimized, return original
        if (!state.showOptimized) {
          console.log('[ResumeStore] getActiveResume: Returning original');
          return state.originalResume;
        }

        console.log('[ResumeStore] getActiveResume: Merging optimizations');
        
        // Deep clone the original
        const merged = JSON.parse(JSON.stringify(state.originalResume)) as ResumeData;

        // Apply each applied optimization
        for (const opt of state.optimizations) {
          if (!opt.applied) continue;

          switch (opt.sectionType) {
            case 'summary':
              merged.summary = opt.optimized as string;
              break;

            case 'headline':
              if (merged.personalInfo) {
                merged.personalInfo.title = opt.optimized as string;
              }
              break;

            case 'experience':
              const expIndex = merged.experience?.findIndex(e => e.id === opt.sectionId);
              if (expIndex !== undefined && expIndex !== -1 && merged.experience) {
                merged.experience[expIndex] = {
                  ...merged.experience[expIndex],
                  description: opt.optimized as string[],
                  isOptimized: true,
                };
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
        console.log('[ResumeStore] Clearing all data');
        set({
          originalResume: null,
          parsedResumeText: null,
          optimizations: [],
          keywordSuggestions: [],
          showOptimized: false,
        });
      },
    }),
    {
      name: 'resume-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        originalResume: state.originalResume,
        parsedResumeText: state.parsedResumeText,
        optimizations: state.optimizations,
        selectedTemplate: state.selectedTemplate,
        showOptimized: state.showOptimized,
      }),
    }
  )
);
```

---

## Bug 3: Optimize Section Shows No Content

**Cause:** OptimizeSection isn't receiving resume data and isn't calling the API.

**Fix:** Update `src/components/sections/OptimizeSection.tsx`:

```typescript
// src/components/sections/OptimizeSection.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useResumeStore, OptimizationResult } from '../../lib/stores/resumeStore';
import { 
  Sparkles, 
  Check, 
  RotateCcw, 
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface OptimizeSectionProps {
  // Optional: can pass resume text directly or use store
  resumeText?: string | null;
}

export function OptimizeSection({ resumeText: propResumeText }: OptimizeSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  // Get data from store
  const { 
    originalResume,
    parsedResumeText,
    optimizations,
    setOptimizations,
    applyOptimization,
    revertOptimization,
    applyAllOptimizations,
    showOptimized,
    toggleShowOptimized,
  } = useResumeStore();

  // Use prop or store
  const resumeText = propResumeText || parsedResumeText;

  const [activeSection, setActiveSection] = useState<'all' | 'headline' | 'summary' | 'experience' | 'skills'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if we have resume data
  const hasResume = Boolean(originalResume || resumeText);

  // Generate optimizations from API
  const handleGenerate = async () => {
    if (!resumeText && !originalResume) {
      setError('Please upload a resume first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeText || JSON.stringify(originalResume),
          sections: activeSection === 'all' ? ['headline', 'summary', 'experience', 'skills'] : [activeSection],
        }),
      });

      if (!response.ok) {
        throw new Error('Optimization failed');
      }

      const data = await response.json();
      
      // Transform API response to OptimizationResult format
      const newOptimizations: OptimizationResult[] = [];
      
      if (data.headline) {
        newOptimizations.push({
          sectionId: 'headline',
          sectionType: 'headline',
          original: originalResume?.personalInfo?.title || 'No headline',
          optimized: data.headline,
          applied: false,
        });
      }
      
      if (data.summary) {
        newOptimizations.push({
          sectionId: 'summary',
          sectionType: 'summary',
          original: originalResume?.summary || 'No summary',
          optimized: data.summary,
          applied: false,
        });
      }
      
      if (data.experience && Array.isArray(data.experience)) {
        data.experience.forEach((exp: any, index: number) => {
          newOptimizations.push({
            sectionId: `experience-${index}`,
            sectionType: 'experience',
            original: originalResume?.experience?.[index]?.description || [],
            optimized: exp.bullets || exp.description || [],
            applied: false,
          });
        });
      }
      
      if (data.skills) {
        newOptimizations.push({
          sectionId: 'skills',
          sectionType: 'skills',
          original: originalResume?.skills || [],
          optimized: data.skills,
          applied: false,
        });
      }

      setOptimizations(newOptimizations);
      
    } catch (err) {
      console.error('Optimization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate optimizations');
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter optimizations by section
  const filteredOptimizations = activeSection === 'all'
    ? optimizations
    : optimizations.filter(o => o.sectionType === activeSection);

  const appliedCount = optimizations.filter(o => o.applied).length;

  // Section tabs
  const tabs = [
    { id: 'all', label: 'All Sections', labelAr: 'جميع الأقسام' },
    { id: 'headline', label: 'Headline', labelAr: 'العنوان' },
    { id: 'summary', label: 'Summary', labelAr: 'الملخص' },
    { id: 'experience', label: 'Experience', labelAr: 'الخبرة' },
    { id: 'skills', label: 'Skills', labelAr: 'المهارات' },
  ];

  return (
    <div className="space-y-6">
      {/* Main Card */}
      <GlassCard variant="elevated">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isArabic ? 'التحسين' : 'Optimize Resume'}
              </h3>
              <p className="text-sm text-gray-400">
                {isArabic ? 'اقتراحات مدعومة بالذكاء الاصطناعي' : 'AI-powered suggestions to improve your resume'}
              </p>
            </div>
          </div>
          
          {/* Applied Counter */}
          {optimizations.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {appliedCount}/{optimizations.length} {isArabic ? 'مُطبّق' : 'Applied'}
              </span>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={applyAllOptimizations}
                disabled={appliedCount === optimizations.length}
              >
                {isArabic ? 'تطبيق الكل' : 'Apply All'}
              </GlassButton>
            </div>
          )}
        </div>

        {/* Show Original/Optimized Toggle */}
        <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              showOptimized ? "bg-emerald-400" : "bg-gray-400"
            )} />
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
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors",
              showOptimized ? 'bg-emerald-600' : 'bg-gray-600'
            )}
          >
            <span 
              className={cn(
                "absolute top-1 w-5 h-5 bg-white rounded-full transition-transform",
                showOptimized ? 'left-8' : 'left-1'
              )}
            />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-white/5 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeSection === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              )}
            >
              {isArabic ? tab.labelAr : tab.label}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* No Resume Warning */}
        {!hasResume && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-400">
              {isArabic ? 'يرجى رفع سيرة ذاتية أولاً' : 'Please upload a resume first'}
            </p>
          </div>
        )}

        {/* Generate Button */}
        <GlassButton
          onClick={handleGenerate}
          isLoading={isGenerating}
          disabled={!hasResume || isGenerating}
          className="w-full mb-6"
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          {isGenerating 
            ? (isArabic ? 'جاري التحسين...' : 'Optimizing...')
            : (isArabic ? 'تحسين بالذكاء الاصطناعي' : 'Optimize with AI')
          }
        </GlassButton>

        {/* Optimizations List */}
        <div className="space-y-4">
          {filteredOptimizations.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{isArabic ? 'لا توجد تحسينات متاحة' : 'No optimizations yet'}</p>
              <p className="text-sm mt-1">
                {isArabic ? 'انقر على الزر أعلاه للبدء' : 'Click the button above to generate'}
              </p>
            </div>
          ) : (
            filteredOptimizations.map((opt) => (
              <div
                key={opt.sectionId}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  opt.applied
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-white/5 border-white/10'
                )}
              >
                {/* Item Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {opt.applied && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                    <h4 className="font-medium text-white capitalize">
                      {opt.sectionType === 'experience' 
                        ? `${isArabic ? 'الخبرة' : 'Experience'} ${opt.sectionId.split('-')[1] ? Number(opt.sectionId.split('-')[1]) + 1 : ''}`
                        : isArabic 
                          ? tabs.find(t => t.id === opt.sectionType)?.labelAr 
                          : opt.sectionType
                      }
                    </h4>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs',
                      opt.applied 
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/10 text-gray-400'
                    )}>
                      {opt.applied 
                        ? (isArabic ? 'مُطبّق' : 'Applied')
                        : (isArabic ? 'الأصلي' : 'Original')
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCompareMode(compareMode === opt.sectionId ? null : opt.sectionId)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        compareMode === opt.sectionId 
                          ? "bg-purple-500/20 text-purple-400"
                          : "hover:bg-white/10 text-gray-400"
                      )}
                      title={isArabic ? 'مقارنة' : 'Compare'}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === opt.sectionId ? null : opt.sectionId)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {expandedId === opt.sectionId 
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                  </div>
                </div>

                {/* Compare Mode */}
                {compareMode === opt.sectionId && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">{isArabic ? 'الأصلي' : 'Original'}</p>
                      <p className="text-sm text-gray-300">
                        {Array.isArray(opt.original) 
                          ? opt.original.join(', ') 
                          : opt.original || 'No content'
                        }
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                      <p className="text-xs text-emerald-400 mb-2">{isArabic ? 'المحسّن' : 'Optimized'}</p>
                      <p className="text-sm text-white">
                        {Array.isArray(opt.optimized) 
                          ? opt.optimized.join(', ') 
                          : opt.optimized || 'No content'
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Expanded Content */}
                {expandedId === opt.sectionId && compareMode !== opt.sectionId && (
                  <div className="mb-4 p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">
                      {opt.applied ? (isArabic ? 'المحتوى المحسّن' : 'Optimized Content') : (isArabic ? 'المحتوى الأصلي' : 'Original Content')}
                    </p>
                    <p className="text-sm text-gray-300">
                      {opt.applied
                        ? (Array.isArray(opt.optimized) ? opt.optimized.join('\n• ') : opt.optimized)
                        : (Array.isArray(opt.original) ? opt.original.join('\n• ') : opt.original)
                      }
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {opt.applied ? (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => revertOptimization(opt.sectionId)}
                      leftIcon={<RotateCcw className="w-3 h-3" />}
                    >
                      {isArabic ? 'التراجع' : 'Revert'}
                    </GlassButton>
                  ) : (
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => applyOptimization(opt.sectionId)}
                      leftIcon={<Check className="w-3 h-3" />}
                    >
                      {isArabic ? 'تطبيق' : 'Apply'}
                    </GlassButton>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* Keyword Focus Card */}
      <KeywordFocusCard />
    </div>
  );
}

// Keyword Focus Component (the ADD/KEEP/DE-EMPHASIZE section from your screenshot)
function KeywordFocusCard() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const { keywordSuggestions } = useResumeStore();

  // Group keywords by category
  const addKeywords = keywordSuggestions.filter(k => k.category === 'add');
  const keepKeywords = keywordSuggestions.filter(k => k.category === 'keep');
  const deemphasizeKeywords = keywordSuggestions.filter(k => k.category === 'deemphasize');

  return (
    <GlassCard variant="default">
      <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4">
        {isArabic ? 'تركيز الكلمات المفتاحية' : 'KEYWORD FOCUS'}
      </h4>
      
      <div className="grid grid-cols-3 gap-6">
        {/* ADD Column */}
        <div>
          <h5 className="text-sm font-medium text-gray-400 mb-3">
            {isArabic ? 'إضافة' : 'ADD'}
          </h5>
          <div className="flex flex-wrap gap-2">
            {addKeywords.length > 0 ? (
              addKeywords.map((k, i) => (
                <span key={i} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                  {k.keyword}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">{isArabic ? 'لا توجد عناصر' : 'No items yet'}</span>
            )}
          </div>
        </div>

        {/* KEEP Column */}
        <div>
          <h5 className="text-sm font-medium text-gray-400 mb-3">
            {isArabic ? 'الاحتفاظ' : 'KEEP'}
          </h5>
          <div className="flex flex-wrap gap-2">
            {keepKeywords.length > 0 ? (
              keepKeywords.map((k, i) => (
                <span key={i} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                  {k.keyword}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">{isArabic ? 'لا توجد عناصر' : 'No items yet'}</span>
            )}
          </div>
        </div>

        {/* DE-EMPHASIZE Column */}
        <div>
          <h5 className="text-sm font-medium text-gray-400 mb-3">
            {isArabic ? 'تقليل التركيز' : 'DE-EMPHASIZE'}
          </h5>
          <div className="flex flex-wrap gap-2">
            {deemphasizeKeywords.length > 0 ? (
              deemphasizeKeywords.map((k, i) => (
                <span key={i} className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm">
                  {k.keyword}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">{isArabic ? 'لا توجد عناصر' : 'No items yet'}</span>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default OptimizeSection;
```

---

## Bug 4: Templates Showing Mock Data

**Cause:** TemplatesSection uses `SAMPLE_RESUME` instead of actual user data from store.

**Fix:** Update `src/components/sections/TemplatesSection.tsx`:

```typescript
// src/components/sections/TemplatesSection.tsx
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { pdf } from '@react-pdf/renderer';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { TEMPLATE_CONFIGS, TEMPLATES } from '../templates';
import { ResumePDFDocument } from '../templates/ResumePDFDocument';
import { TemplateId, ResumeData } from '../../types/resume';
import { 
  Download, 
  FileText, 
  Printer, 
  Check, 
  Eye, 
  EyeOff,
  Loader2,
  AlertCircle 
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

// Fallback sample data - ONLY used when no resume is uploaded
const SAMPLE_RESUME: ResumeData = {
  personalInfo: {
    name: 'Your Name',
    title: 'Your Job Title',
    email: 'email@example.com',
    phone: '+966 5X XXX XXXX',
    location: 'Riyadh, SA',
    linkedin: '',
    website: '',
  },
  summary: 'Upload your resume to see your professional summary here.',
  experience: [
    {
      id: 'sample-1',
      title: 'Job Title',
      company: 'Company Name',
      location: 'Location',
      startDate: '2020',
      endDate: '',
      current: true,
      description: ['Upload your resume to see your experience here.'],
    },
  ],
  education: [
    {
      id: 'sample-edu-1',
      degree: 'Degree Name',
      institution: 'University Name',
      location: '',
      graduationDate: '2020',
    },
  ],
  skills: ['Skill 1', 'Skill 2', 'Skill 3'],
  languages: [{ name: 'English', level: 'Fluent' }],
  certifications: [],
};

export function TemplatesSection() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const previewRef = useRef<HTMLDivElement>(null);

  // Get resume data from store
  const { 
    selectedTemplate, 
    setSelectedTemplate,
    showOptimized,
    toggleShowOptimized,
    getActiveResume,
    originalResume,
  } = useResumeStore();

  const [category, setCategory] = useState<'all' | 'modern' | 'classic' | 'technical'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Get the actual resume - use store data, fallback to sample only if nothing uploaded
  const activeResume = getActiveResume();
  const resume: ResumeData = activeResume || SAMPLE_RESUME;
  const hasRealResume = Boolean(activeResume);

  // Filter templates by category
  const filteredTemplates = TEMPLATE_CONFIGS.filter(
    t => category === 'all' || t.category === category
  );

  // Get current template component
  const Template = TEMPLATES[selectedTemplate as TemplateId] || TEMPLATES['modern-professional'];
  const templateConfig = TEMPLATE_CONFIGS.find(t => t.id === selectedTemplate) || TEMPLATE_CONFIGS[0];

  // Handle PDF download
  const handleDownloadPdf = async () => {
    if (!hasRealResume) {
      setExportError('Please upload a resume first');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const blob = await pdf(<ResumePDFDocument resume={resume} />).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resume.personalInfo.name.replace(/\s+/g, '_')}_Resume.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('PDF Download failed:', err);
      setExportError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle print
  const handlePrint = () => {
    if (!previewRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setExportError('Please allow popups for printing');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${resume.personalInfo.name} - Resume</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; }
            * { box-sizing: border-box; }
          </style>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        </head>
        <body>
          ${previewRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Template Selector - Left Panel */}
      <div className="col-span-4">
        <GlassCard variant="elevated">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {isArabic ? 'القوالب' : 'Templates'}
            </h3>
          </div>

          {/* Optimized Toggle */}
          <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2">
              {showOptimized ? (
                <Eye className="w-4 h-4 text-emerald-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm text-gray-300">
                {showOptimized 
                  ? (isArabic ? 'عرض المحسّن' : 'Showing Optimized')
                  : (isArabic ? 'عرض الأصلي' : 'Showing Original')
                }
              </span>
            </div>
            <button
              onClick={toggleShowOptimized}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors",
                showOptimized ? 'bg-emerald-600' : 'bg-gray-600'
              )}
            >
              <span 
                className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform",
                  showOptimized ? 'left-6' : 'left-0.5'
                )}
              />
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 mb-4">
            {(['all', 'modern', 'classic', 'technical'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  category === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                )}
              >
                {cat === 'all' ? (isArabic ? 'الكل' : 'All') :
                 cat === 'modern' ? (isArabic ? 'عصري' : 'Modern') :
                 cat === 'classic' ? (isArabic ? 'كلاسيكي' : 'Classic') :
                 (isArabic ? 'تقني' : 'Technical')}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredTemplates.map((config) => {
              const isSelected = selectedTemplate === config.id;
              
              return (
                <button
                  key={config.id}
                  onClick={() => setSelectedTemplate(config.id)}
                  className={cn(
                    'relative rounded-xl overflow-hidden border-2 transition-all',
                    isSelected 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/50' 
                      : 'border-gray-700 hover:border-gray-500'
                  )}
                >
                  {/* Template Preview Thumbnail */}
                  <div className="aspect-[210/297] bg-white p-2">
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-400 text-center px-2">
                        {isArabic ? config.nameAr : config.name}
                      </span>
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Label */}
                  <div 
                    className="py-2 text-center text-xs font-medium text-white"
                    style={{ backgroundColor: config.previewColor }}
                  >
                    {isArabic ? config.nameAr : config.name}
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Resume Preview - Right Panel */}
      <div className="col-span-8">
        <GlassCard variant="elevated" padding="none">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <h3 className="font-semibold text-white">
                {isArabic ? templateConfig.nameAr : templateConfig.name}
              </h3>
              <p className="text-sm text-gray-400">
                {showOptimized 
                  ? (isArabic ? 'النسخة المحسّنة' : 'Optimized Version')
                  : (isArabic ? 'النسخة الأصلية' : 'Original Version')
                }
                {' • '}
                {isArabic ? templateConfig.nameAr : templateConfig.category}
              </p>
            </div>
            <div className="flex gap-2">
              <GlassButton
                onClick={handleDownloadPdf}
                disabled={!hasRealResume || isExporting}
                isLoading={isExporting}
                leftIcon={<Download className="w-4 h-4" />}
              >
                {isArabic ? 'تحميل PDF' : 'Download PDF'}
              </GlassButton>
              <GlassButton
                variant="secondary"
                onClick={handlePrint}
                disabled={!hasRealResume}
              >
                <Printer className="w-4 h-4" />
              </GlassButton>
            </div>
          </div>

          {/* Error Message */}
          {exportError && (
            <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400">{exportError}</p>
            </div>
          )}

          {/* No Resume Warning */}
          {!hasRealResume && (
            <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <p className="text-sm text-amber-400">
                {isArabic ? 'هذه معاينة تجريبية. ارفع سيرتك الذاتية لرؤية بياناتك.' : 'This is a preview. Upload your resume to see your data.'}
              </p>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 overflow-auto max-h-[800px] bg-gray-950">
            <div 
              ref={previewRef}
              className="bg-white shadow-2xl mx-auto"
              style={{ width: '210mm', minHeight: '297mm' }}
            >
              <Template resume={resume} />
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default TemplatesSection;
```

---

## Bug 5: Wire Up UploadSection to Store

Make sure the upload section saves data to the store. Update `src/components/sections/UploadSection.tsx`:

```typescript
// In the upload handler, after parsing:
import { useResumeStore } from '../../lib/stores/resumeStore';

// Inside component:
const { setOriginalResume, setParsedResumeText } = useResumeStore();

// After successfully parsing resume:
const handleUploadSuccess = (parsedResume: ResumeData, rawText: string) => {
  // Save to store
  setOriginalResume(parsedResume);
  setParsedResumeText(rawText);
  
  console.log('[Upload] Resume saved to store:', parsedResume.personalInfo?.name);
};
```

---

## Verification Checklist

After applying fixes:

- [ ] Upload a resume → Check console for "[ResumeStore] Setting original resume"
- [ ] Go to Optimize → Click "Optimize with AI" → Should show optimizations
- [ ] Toggle "Showing Original/Optimized" → Content should change
- [ ] Go to Templates → Should show YOUR resume, not "JOHNATHAN SMITH"
- [ ] Click "Download PDF" → Should download without font error
- [ ] Check that Headline/Summary cards show your content, not "No original text"

---

## Console Debug Commands

Open browser console and run these to check store state:

```javascript
// Check if resume is in store
const state = JSON.parse(localStorage.getItem('resume-storage'));
console.log('Stored resume:', state?.state?.originalResume?.personalInfo?.name);
console.log('Show optimized:', state?.state?.showOptimized);
console.log('Optimizations:', state?.state?.optimizations?.length);
```
