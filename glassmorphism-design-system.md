# Claude Code Instruction: Glassmorphism Design System & Arabic Translations

## Context
Apply consistent glassmorphism design from the header to all application sections. Ensure full Arabic translation support throughout. Fix upload card alignment issues.

## Design System Reference

Looking at the header, the glass effect uses:
- Background: `bg-white/10` or `bg-gray-900/50`
- Backdrop blur: `backdrop-blur-xl`
- Border: `border border-white/10`
- Shadow: `shadow-xl`
- Rounded corners: `rounded-2xl` or `rounded-3xl`

## Step 1: Create Glass Design System Utilities

Create file: `src/lib/styles/glass.ts`
```typescript
/**
 * Glassmorphism Design System
 * Consistent glass effects across all components
 */

export const glass = {
  // Primary glass card (dark background)
  card: 'bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-xl',
  
  // Light glass card (for contrast)
  cardLight: 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl',
  
  // Elevated glass (more prominent)
  elevated: 'bg-gray-900/80 backdrop-blur-2xl border border-white/15 shadow-2xl',
  
  // Subtle glass (less prominent)
  subtle: 'bg-gray-900/40 backdrop-blur-lg border border-white/5 shadow-lg',
  
  // Input fields
  input: 'bg-white/5 backdrop-blur-sm border border-white/10 focus:border-emerald-500/50 focus:bg-white/10',
  
  // Buttons
  button: {
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/10',
    ghost: 'hover:bg-white/10 text-gray-300 hover:text-white',
  },
  
  // Tabs
  tab: {
    active: 'bg-emerald-600/20 text-emerald-400 border-emerald-500',
    inactive: 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-transparent',
  },
  
  // Badge/Tag
  badge: {
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    neutral: 'bg-white/10 text-gray-300 border border-white/10',
  },
};

// Combine glass classes with custom classes
export function glassCard(variant: 'default' | 'light' | 'elevated' | 'subtle' = 'default', className?: string) {
  const variants = {
    default: glass.card,
    light: glass.cardLight,
    elevated: glass.elevated,
    subtle: glass.subtle,
  };
  return `${variants[variant]} ${className || ''}`.trim();
}
```

## Step 2: Create Reusable Glass Components

Create file: `src/components/ui/GlassCard.tsx`
```typescript
import { ReactNode } from 'react';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils';

interface GlassCardProps {
  children: ReactNode;
  variant?: 'default' | 'light' | 'elevated' | 'subtle';
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'lg' | 'xl' | '2xl' | '3xl';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const roundedMap = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
};

export function GlassCard({
  children,
  variant = 'default',
  className,
  padding = 'md',
  rounded = '2xl',
}: GlassCardProps) {
  const variantStyles = {
    default: glass.card,
    light: glass.cardLight,
    elevated: glass.elevated,
    subtle: glass.subtle,
  };

  return (
    <div
      className={cn(
        variantStyles[variant],
        paddingMap[padding],
        roundedMap[rounded],
        className
      )}
    >
      {children}
    </div>
  );
}
```

Create file: `src/components/ui/GlassButton.tsx`
```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeMap = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    isLoading, 
    leftIcon,
    rightIcon,
    className, 
    disabled,
    ...props 
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          glass.button[variant],
          sizeMap[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';
```

Create file: `src/components/ui/GlassInput.tsx`
```typescript
import { InputHTMLAttributes, forwardRef } from 'react';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, leftIcon, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              glass.input,
              'w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none transition-all',
              leftIcon && 'pl-10',
              error && 'border-red-500/50 focus:border-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
```

Create file: `src/components/ui/GlassTabs.tsx`
```typescript
import { useState } from 'react';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils';

interface Tab {
  id: string;
  label: string;
  labelAr: string;
  icon?: React.ReactNode;
}

interface GlassTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isArabic?: boolean;
}

export function GlassTabs({ tabs, activeTab, onTabChange, isArabic }: GlassTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 p-1 bg-white/5 backdrop-blur-sm rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          )}
        >
          {tab.icon}
          <span>{isArabic ? tab.labelAr : tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

## Step 3: Add Complete Arabic Translations

Update file: `src/locales/en.json` - Add these sections:
```json
{
  "sections": {
    "resume": {
      "title": "Resume",
      "upload": {
        "title": "Upload Your Resume",
        "subtitle": "Drag & drop or click to upload",
        "formats": "PDF, DOCX up to 5MB",
        "paste": "Or paste your resume text",
        "pastePlaceholder": "Paste your resume content here...",
        "analyzing": "Analyzing your resume...",
        "success": "Resume uploaded successfully"
      }
    },
    "match": {
      "title": "Match",
      "subtitle": "Compare your resume against job descriptions",
      "jobInput": {
        "title": "Job Description",
        "placeholder": "Paste the job description here...",
        "url": "Or enter job posting URL"
      },
      "results": {
        "title": "Match Analysis",
        "score": "Match Score",
        "keywords": "Keywords Found",
        "missing": "Missing Keywords",
        "suggestions": "Suggestions"
      },
      "analyze": "Analyze Match",
      "analyzing": "Analyzing...",
      "noResume": "Please upload a resume first"
    },
    "optimize": {
      "title": "Optimize",
      "subtitle": "AI-powered suggestions to improve your resume",
      "sections": {
        "summary": "Professional Summary",
        "experience": "Work Experience",
        "skills": "Skills",
        "all": "All Sections"
      },
      "actions": {
        "optimize": "Optimize",
        "apply": "Apply",
        "applyAll": "Apply All",
        "revert": "Revert",
        "compare": "Compare"
      },
      "status": {
        "original": "Original",
        "optimized": "Optimized",
        "applied": "Applied"
      },
      "generating": "Generating optimizations...",
      "noChanges": "No optimizations available"
    },
    "keywords": {
      "title": "Keywords",
      "subtitle": "Analyze and optimize keywords in your resume",
      "analysis": {
        "title": "Keyword Analysis",
        "density": "Keyword Density",
        "relevance": "Relevance Score",
        "atsScore": "ATS Score"
      },
      "categories": {
        "technical": "Technical Skills",
        "soft": "Soft Skills",
        "industry": "Industry Terms",
        "action": "Action Verbs"
      },
      "suggestions": {
        "title": "Suggested Keywords",
        "add": "Add to Resume",
        "added": "Added"
      }
    },
    "templates": {
      "title": "Templates",
      "subtitle": "Choose a professional template for your resume",
      "categories": {
        "all": "All",
        "modern": "Modern",
        "classic": "Classic",
        "technical": "Technical"
      },
      "preview": {
        "title": "Preview",
        "showing": "Showing",
        "original": "Original",
        "optimized": "Optimized"
      },
      "export": {
        "download": "Download PDF",
        "ats": "ATS-Friendly",
        "styled": "Styled"
      }
    },
    "interview": {
      "title": "Interview",
      "subtitle": "Prepare for interviews with AI-generated questions",
      "generate": "Generate Questions",
      "generating": "Generating questions...",
      "categories": {
        "behavioral": "Behavioral",
        "technical": "Technical",
        "situational": "Situational",
        "general": "General"
      },
      "question": {
        "sample": "Sample Answer",
        "tips": "Tips",
        "practice": "Practice"
      },
      "settings": {
        "difficulty": "Difficulty",
        "easy": "Easy",
        "medium": "Medium",
        "hard": "Hard",
        "count": "Number of Questions"
      }
    },
    "bulkAnalysis": {
      "title": "Bulk Analysis",
      "subtitle": "Analyze multiple resumes or job descriptions at once",
      "upload": {
        "title": "Upload Files",
        "subtitle": "Upload multiple files for batch processing",
        "limit": "Up to 10 files at a time"
      },
      "results": {
        "title": "Analysis Results",
        "processing": "Processing",
        "complete": "Complete",
        "failed": "Failed"
      },
      "export": {
        "csv": "Export CSV",
        "pdf": "Export Report"
      }
    },
    "coverLetter": {
      "title": "Cover Letter",
      "subtitle": "Generate a tailored cover letter for your application",
      "inputs": {
        "company": "Company Name",
        "position": "Position",
        "tone": "Tone",
        "tones": {
          "professional": "Professional",
          "friendly": "Friendly",
          "confident": "Confident",
          "enthusiastic": "Enthusiastic"
        }
      },
      "generate": "Generate Cover Letter",
      "generating": "Writing your cover letter...",
      "result": {
        "title": "Your Cover Letter",
        "copy": "Copy",
        "download": "Download",
        "regenerate": "Regenerate"
      }
    }
  },
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "retry": "Try Again",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "copy": "Copy",
    "copied": "Copied!",
    "download": "Download",
    "upload": "Upload",
    "clear": "Clear",
    "clearAll": "Clear All",
    "continue": "Continue",
    "back": "Back",
    "next": "Next",
    "finish": "Finish",
    "or": "or",
    "and": "and"
  }
}
```

Update file: `src/locales/ar.json` - Add these sections:
```json
{
  "sections": {
    "resume": {
      "title": "السيرة الذاتية",
      "upload": {
        "title": "ارفع سيرتك الذاتية",
        "subtitle": "اسحب وأفلت أو انقر للرفع",
        "formats": "PDF، DOCX حتى 5 ميجابايت",
        "paste": "أو الصق نص سيرتك الذاتية",
        "pastePlaceholder": "الصق محتوى سيرتك الذاتية هنا...",
        "analyzing": "جاري تحليل سيرتك الذاتية...",
        "success": "تم رفع السيرة الذاتية بنجاح"
      }
    },
    "match": {
      "title": "المطابقة",
      "subtitle": "قارن سيرتك الذاتية مع أوصاف الوظائف",
      "jobInput": {
        "title": "وصف الوظيفة",
        "placeholder": "الصق وصف الوظيفة هنا...",
        "url": "أو أدخل رابط إعلان الوظيفة"
      },
      "results": {
        "title": "تحليل المطابقة",
        "score": "نسبة التطابق",
        "keywords": "الكلمات المفتاحية الموجودة",
        "missing": "الكلمات المفتاحية المفقودة",
        "suggestions": "الاقتراحات"
      },
      "analyze": "تحليل المطابقة",
      "analyzing": "جاري التحليل...",
      "noResume": "يرجى رفع سيرة ذاتية أولاً"
    },
    "optimize": {
      "title": "التحسين",
      "subtitle": "اقتراحات مدعومة بالذكاء الاصطناعي لتحسين سيرتك الذاتية",
      "sections": {
        "summary": "الملخص المهني",
        "experience": "الخبرة العملية",
        "skills": "المهارات",
        "all": "جميع الأقسام"
      },
      "actions": {
        "optimize": "تحسين",
        "apply": "تطبيق",
        "applyAll": "تطبيق الكل",
        "revert": "التراجع",
        "compare": "مقارنة"
      },
      "status": {
        "original": "الأصلي",
        "optimized": "المحسّن",
        "applied": "مُطبّق"
      },
      "generating": "جاري إنشاء التحسينات...",
      "noChanges": "لا توجد تحسينات متاحة"
    },
    "keywords": {
      "title": "الكلمات المفتاحية",
      "subtitle": "تحليل وتحسين الكلمات المفتاحية في سيرتك الذاتية",
      "analysis": {
        "title": "تحليل الكلمات المفتاحية",
        "density": "كثافة الكلمات المفتاحية",
        "relevance": "درجة الصلة",
        "atsScore": "نتيجة ATS"
      },
      "categories": {
        "technical": "المهارات التقنية",
        "soft": "المهارات الشخصية",
        "industry": "مصطلحات الصناعة",
        "action": "أفعال الإنجاز"
      },
      "suggestions": {
        "title": "الكلمات المفتاحية المقترحة",
        "add": "إضافة للسيرة الذاتية",
        "added": "تمت الإضافة"
      }
    },
    "templates": {
      "title": "القوالب",
      "subtitle": "اختر قالباً احترافياً لسيرتك الذاتية",
      "categories": {
        "all": "الكل",
        "modern": "عصري",
        "classic": "كلاسيكي",
        "technical": "تقني"
      },
      "preview": {
        "title": "معاينة",
        "showing": "عرض",
        "original": "الأصلي",
        "optimized": "المحسّن"
      },
      "export": {
        "download": "تحميل PDF",
        "ats": "متوافق مع ATS",
        "styled": "منسّق"
      }
    },
    "interview": {
      "title": "المقابلة",
      "subtitle": "استعد للمقابلات مع أسئلة مولدة بالذكاء الاصطناعي",
      "generate": "توليد الأسئلة",
      "generating": "جاري توليد الأسئلة...",
      "categories": {
        "behavioral": "سلوكية",
        "technical": "تقنية",
        "situational": "موقفية",
        "general": "عامة"
      },
      "question": {
        "sample": "نموذج إجابة",
        "tips": "نصائح",
        "practice": "تدريب"
      },
      "settings": {
        "difficulty": "مستوى الصعوبة",
        "easy": "سهل",
        "medium": "متوسط",
        "hard": "صعب",
        "count": "عدد الأسئلة"
      }
    },
    "bulkAnalysis": {
      "title": "التحليل الجماعي",
      "subtitle": "تحليل عدة سير ذاتية أو أوصاف وظائف دفعة واحدة",
      "upload": {
        "title": "رفع الملفات",
        "subtitle": "ارفع عدة ملفات للمعالجة الجماعية",
        "limit": "حتى 10 ملفات في المرة"
      },
      "results": {
        "title": "نتائج التحليل",
        "processing": "قيد المعالجة",
        "complete": "مكتمل",
        "failed": "فشل"
      },
      "export": {
        "csv": "تصدير CSV",
        "pdf": "تصدير التقرير"
      }
    },
    "coverLetter": {
      "title": "خطاب التقديم",
      "subtitle": "أنشئ خطاب تقديم مخصص لطلبك",
      "inputs": {
        "company": "اسم الشركة",
        "position": "المنصب",
        "tone": "النبرة",
        "tones": {
          "professional": "مهني",
          "friendly": "ودي",
          "confident": "واثق",
          "enthusiastic": "حماسي"
        }
      },
      "generate": "إنشاء خطاب التقديم",
      "generating": "جاري كتابة خطاب التقديم...",
      "result": {
        "title": "خطاب التقديم الخاص بك",
        "copy": "نسخ",
        "download": "تحميل",
        "regenerate": "إعادة الإنشاء"
      }
    }
  },
  "common": {
    "loading": "جاري التحميل...",
    "error": "حدث خطأ",
    "retry": "حاول مجدداً",
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "edit": "تعديل",
    "copy": "نسخ",
    "copied": "تم النسخ!",
    "download": "تحميل",
    "upload": "رفع",
    "clear": "مسح",
    "clearAll": "مسح الكل",
    "continue": "متابعة",
    "back": "رجوع",
    "next": "التالي",
    "finish": "إنهاء",
    "or": "أو",
    "and": "و"
  }
}
```

## Step 4: Create Section Components with Glass Design

### Upload Card (Fixed Alignment)
Create file: `src/components/sections/UploadCard.tsx`
```typescript
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { Upload, FileText, X, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface UploadCardProps {
  onFileUpload: (file: File) => Promise<void>;
  onTextPaste: (text: string) => void;
  isProcessing?: boolean;
  uploadedFile?: { name: string; size: number } | null;
}

export function UploadCard({ 
  onFileUpload, 
  onTextPaste, 
  isProcessing,
  uploadedFile 
}: UploadCardProps) {
  const { t } = useTranslation();
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      await onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handlePasteSubmit = () => {
    if (pasteText.trim()) {
      onTextPaste(pasteText);
    }
  };

  return (
    <GlassCard variant="elevated" className="w-full">
      {/* Header - Fixed alignment with flex */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {t('sections.resume.upload.title')}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {t('sections.resume.upload.subtitle')}
          </p>
        </div>
        {uploadedFile && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-lg">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">{t('sections.resume.upload.success')}</span>
          </div>
        )}
      </div>

      {/* Upload/Paste Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPasteMode(false)}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            !pasteMode 
              ? 'bg-emerald-600 text-white' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          )}
        >
          <Upload className="w-4 h-4 inline-block me-2" />
          {t('common.upload')}
        </button>
        <button
          onClick={() => setPasteMode(true)}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            pasteMode 
              ? 'bg-emerald-600 text-white' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          )}
        >
          <FileText className="w-4 h-4 inline-block me-2" />
          {t('sections.resume.upload.paste')}
        </button>
      </div>

      {/* Content Area - Consistent height */}
      <div className="min-h-[200px]">
        {!pasteMode ? (
          /* Dropzone */
          <div
            {...getRootProps()}
            className={cn(
              'relative h-[200px] border-2 border-dashed rounded-xl transition-all cursor-pointer',
              'flex flex-col items-center justify-center gap-4',
              isDragActive
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/20 hover:border-emerald-500/50 hover:bg-white/5',
              isProcessing && 'pointer-events-none opacity-50'
            )}
          >
            <input {...getInputProps()} />
            
            {isProcessing ? (
              <>
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-gray-400">{t('sections.resume.upload.analyzing')}</p>
              </>
            ) : uploadedFile ? (
              <>
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-400">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Clear file logic
                  }}
                  className="absolute top-3 end-3 p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-white">
                    {isDragActive 
                      ? 'Drop your file here' 
                      : t('sections.resume.upload.subtitle')
                    }
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('sections.resume.upload.formats')}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Paste Area */
          <div className="h-[200px] flex flex-col">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t('sections.resume.upload.pastePlaceholder')}
              className={cn(
                'flex-1 w-full p-4 rounded-xl resize-none',
                'bg-white/5 border border-white/10',
                'text-white placeholder-gray-500',
                'focus:outline-none focus:border-emerald-500/50 focus:bg-white/10',
                'transition-all'
              )}
            />
            <GlassButton
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || isProcessing}
              isLoading={isProcessing}
              className="mt-3 w-full"
            >
              {t('sections.match.analyze')}
            </GlassButton>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
```

### Match Section
Create file: `src/components/sections/MatchSection.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { Target, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MatchResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

interface MatchSectionProps {
  onAnalyze: (jobDescription: string) => Promise<MatchResult>;
  hasResume: boolean;
}

export function MatchSection({ onAnalyze, hasResume }: MatchSectionProps) {
  const { t } = useTranslation();
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);

  const handleAnalyze = async () => {
    if (!jobDescription.trim() || !hasResume) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await onAnalyze(jobDescription);
      setResult(analysis);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/20 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/20 border-amber-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.match.jobInput.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.match.subtitle')}
            </p>
          </div>
        </div>

        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder={t('sections.match.jobInput.placeholder')}
          className={cn(
            'w-full h-64 p-4 rounded-xl resize-none mb-4',
            'bg-white/5 border border-white/10',
            'text-white placeholder-gray-500',
            'focus:outline-none focus:border-emerald-500/50 focus:bg-white/10',
            'transition-all'
          )}
        />

        {!hasResume && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-400">{t('sections.match.noResume')}</p>
          </div>
        )}

        <GlassButton
          onClick={handleAnalyze}
          disabled={!jobDescription.trim() || !hasResume || isAnalyzing}
          isLoading={isAnalyzing}
          className="w-full"
        >
          {t('sections.match.analyze')}
        </GlassButton>
      </GlassCard>

      {/* Results Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            {t('sections.match.results.title')}
          </h3>
        </div>

        {result ? (
          <div className="space-y-6">
            {/* Score */}
            <div className={cn(
              'p-6 rounded-xl border text-center',
              getScoreBg(result.score)
            )}>
              <p className="text-sm text-gray-400 mb-2">{t('sections.match.results.score')}</p>
              <p className={cn('text-5xl font-bold', getScoreColor(result.score))}>
                {result.score}%
              </p>
            </div>

            {/* Matched Keywords */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-sm font-medium text-gray-300">
                  {t('sections.match.results.keywords')} ({result.matchedKeywords.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.matchedKeywords.map((keyword, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Keywords */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm font-medium text-gray-300">
                  {t('sections.match.results.missing')} ({result.missingKeywords.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.missingKeywords.map((keyword, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('sections.match.subtitle')}</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
```

### Optimize Section
Create file: `src/components/sections/OptimizeSection.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassTabs } from '../ui/GlassTabs';
import { 
  Sparkles, 
  Check, 
  RotateCcw, 
  ArrowLeftRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Optimization {
  id: string;
  section: 'summary' | 'experience' | 'skills';
  title: string;
  original: string;
  optimized: string;
  applied: boolean;
}

interface OptimizeSectionProps {
  optimizations: Optimization[];
  onApply: (id: string) => void;
  onRevert: (id: string) => void;
  onApplyAll: () => void;
  onGenerate: (section: string) => Promise<void>;
  isGenerating: boolean;
}

export function OptimizeSection({
  optimizations,
  onApply,
  onRevert,
  onApplyAll,
  onGenerate,
  isGenerating,
}: OptimizeSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [activeSection, setActiveSection] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<string | null>(null);

  const tabs = [
    { id: 'all', label: 'All Sections', labelAr: 'جميع الأقسام', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'summary', label: 'Summary', labelAr: 'الملخص', icon: null },
    { id: 'experience', label: 'Experience', labelAr: 'الخبرة', icon: null },
    { id: 'skills', label: 'Skills', labelAr: 'المهارات', icon: null },
  ];

  const filteredOptimizations = activeSection === 'all'
    ? optimizations
    : optimizations.filter(o => o.section === activeSection);

  const appliedCount = optimizations.filter(o => o.applied).length;

  return (
    <GlassCard variant="elevated">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.optimize.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.optimize.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {appliedCount}/{optimizations.length} {t('sections.optimize.status.applied')}
          </span>
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={onApplyAll}
            disabled={appliedCount === optimizations.length}
          >
            {t('sections.optimize.actions.applyAll')}
          </GlassButton>
        </div>
      </div>

      {/* Section Tabs */}
      <GlassTabs
        tabs={tabs}
        activeTab={activeSection}
        onTabChange={setActiveSection}
        isArabic={isArabic}
      />

      {/* Generate Button */}
      <div className="mt-4 mb-6">
        <GlassButton
          onClick={() => onGenerate(activeSection)}
          isLoading={isGenerating}
          className="w-full"
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          {isGenerating 
            ? t('sections.optimize.generating')
            : t('sections.optimize.actions.optimize')
          }
        </GlassButton>
      </div>

      {/* Optimizations List */}
      <div className="space-y-4">
        {filteredOptimizations.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t('sections.optimize.noChanges')}</p>
          </div>
        ) : (
          filteredOptimizations.map((opt) => (
            <div
              key={opt.id}
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
                  <h4 className="font-medium text-white">{opt.title}</h4>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    opt.applied 
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/10 text-gray-400'
                  )}>
                    {opt.applied 
                      ? t('sections.optimize.status.applied')
                      : t('sections.optimize.status.original')
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCompareMode(compareMode === opt.id ? null : opt.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={t('sections.optimize.actions.compare')}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === opt.id ? null : opt.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {expandedId === opt.id 
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </button>
                </div>
              </div>

              {/* Compare Mode */}
              {compareMode === opt.id && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">{t('sections.optimize.status.original')}</p>
                    <p className="text-sm text-gray-300">{opt.original}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <p className="text-xs text-emerald-400 mb-2">{t('sections.optimize.status.optimized')}</p>
                    <p className="text-sm text-white">{opt.optimized}</p>
                  </div>
                </div>
              )}

              {/* Expanded Content */}
              {expandedId === opt.id && !compareMode && (
                <div className="mb-4 p-3 bg-white/5 rounded-lg">
                  <p className="text-sm text-gray-300">
                    {opt.applied ? opt.optimized : opt.original}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {opt.applied ? (
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onRevert(opt.id)}
                    leftIcon={<RotateCcw className="w-3 h-3" />}
                  >
                    {t('sections.optimize.actions.revert')}
                  </GlassButton>
                ) : (
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => onApply(opt.id)}
                    leftIcon={<Check className="w-3 h-3" />}
                  >
                    {t('sections.optimize.actions.apply')}
                  </GlassButton>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
```

### Keywords Section
Create file: `src/components/sections/KeywordsSection.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { Key, Plus, Check, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

interface KeywordAnalysis {
  atsScore: number;
  density: number;
  categories: {
    technical: string[];
    soft: string[];
    industry: string[];
    action: string[];
  };
  suggestions: string[];
}

interface KeywordsSectionProps {
  analysis: KeywordAnalysis | null;
  onAddKeyword: (keyword: string) => void;
  addedKeywords: string[];
}

export function KeywordsSection({ 
  analysis, 
  onAddKeyword,
  addedKeywords 
}: KeywordsSectionProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<keyof KeywordAnalysis['categories']>('technical');

  const categories = [
    { id: 'technical', label: t('sections.keywords.categories.technical'), color: 'blue' },
    { id: 'soft', label: t('sections.keywords.categories.soft'), color: 'purple' },
    { id: 'industry', label: t('sections.keywords.categories.industry'), color: 'amber' },
    { id: 'action', label: t('sections.keywords.categories.action'), color: 'emerald' },
  ] as const;

  const getColorClasses = (color: string, filled = false) => {
    const colors: Record<string, { bg: string; text: string; filled: string }> = {
      blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', filled: 'bg-blue-500 text-white' },
      purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', filled: 'bg-purple-500 text-white' },
      amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', filled: 'bg-amber-500 text-white' },
      emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', filled: 'bg-emerald-500 text-white' },
    };
    return filled ? colors[color].filled : `${colors[color].bg} ${colors[color].text}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Score Cards */}
      <GlassCard variant="elevated" className="lg:col-span-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            {t('sections.keywords.analysis.title')}
          </h3>
        </div>

        {analysis ? (
          <div className="space-y-4">
            {/* ATS Score */}
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">
                  {t('sections.keywords.analysis.atsScore')}
                </span>
                <span className={cn(
                  'text-2xl font-bold',
                  analysis.atsScore >= 80 ? 'text-emerald-400' :
                  analysis.atsScore >= 60 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {analysis.atsScore}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all',
                    analysis.atsScore >= 80 ? 'bg-emerald-500' :
                    analysis.atsScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${analysis.atsScore}%` }}
                />
              </div>
            </div>

            {/* Keyword Density */}
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  {t('sections.keywords.analysis.density')}
                </span>
                <span className="text-lg font-semibold text-white">
                  {analysis.density}%
                </span>
              </div>
            </div>

            {/* Category Counts */}
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => (
                <div 
                  key={cat.id}
                  className={cn(
                    'p-3 rounded-lg text-center cursor-pointer transition-all',
                    activeCategory === cat.id 
                      ? getColorClasses(cat.color, true)
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  )}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <p className="text-lg font-bold">
                    {analysis.categories[cat.id]?.length || 0}
                  </p>
                  <p className="text-xs">{cat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Upload a resume to analyze keywords</p>
          </div>
        )}
      </GlassCard>

      {/* Keywords Display */}
      <GlassCard variant="elevated" className="lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">
            {categories.find(c => c.id === activeCategory)?.label}
          </h3>
        </div>

        {analysis ? (
          <div className="space-y-6">
            {/* Current Keywords */}
            <div>
              <p className="text-sm text-gray-400 mb-3">Found in your resume</p>
              <div className="flex flex-wrap gap-2">
                {analysis.categories[activeCategory]?.map((keyword, i) => (
                  <span 
                    key={i}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium',
                      getColorClasses(categories.find(c => c.id === activeCategory)?.color || 'blue')
                    )}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-sm text-gray-400">
                  {t('sections.keywords.suggestions.title')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.suggestions.map((keyword, i) => {
                  const isAdded = addedKeywords.includes(keyword);
                  return (
                    <button
                      key={i}
                      onClick={() => !isAdded && onAddKeyword(keyword)}
                      disabled={isAdded}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        isAdded 
                          ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                          : 'bg-white/10 text-white hover:bg-emerald-500/20 hover:text-emerald-400'
                      )}
                    >
                      {isAdded ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      {keyword}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <p>No keywords to display</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
```

### Interview Section
Create file: `src/components/sections/InterviewSection.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassTabs } from '../ui/GlassTabs';
import { 
  MessageSquare, 
  Lightbulb, 
  ChevronDown,
  ChevronUp,
  Sparkles 
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface InterviewQuestion {
  id: string;
  category: 'behavioral' | 'technical' | 'situational' | 'general';
  question: string;
  sampleAnswer: string;
  tips: string[];
}

interface InterviewSectionProps {
  questions: InterviewQuestion[];
  onGenerate: (category: string, difficulty: string, count: number) => Promise<void>;
  isGenerating: boolean;
}

export function InterviewSection({
  questions,
  onGenerate,
  isGenerating,
}: InterviewSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [activeCategory, setActiveCategory] = useState('behavioral');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const tabs = [
    { id: 'behavioral', label: 'Behavioral', labelAr: 'سلوكية', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'technical', label: 'Technical', labelAr: 'تقنية', icon: null },
    { id: 'situational', label: 'Situational', labelAr: 'موقفية', icon: null },
    { id: 'general', label: 'General', labelAr: 'عامة', icon: null },
  ];

  const filteredQuestions = questions.filter(q => q.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.interview.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.interview.subtitle')}
            </p>
          </div>
        </div>

        <GlassTabs
          tabs={tabs}
          activeTab={activeCategory}
          onTabChange={setActiveCategory}
          isArabic={isArabic}
        />

        {/* Settings Row */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {/* Difficulty */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {t('sections.interview.settings.difficulty')}:
            </span>
            <div className="flex gap-1">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                    difficulty === d
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  )}
                >
                  {t(`sections.interview.settings.${d}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {t('sections.interview.settings.count')}:
            </span>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
            >
              {[3, 5, 10].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <GlassButton
            onClick={() => onGenerate(activeCategory, difficulty, questionCount)}
            isLoading={isGenerating}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="ms-auto"
          >
            {t('sections.interview.generate')}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <GlassCard variant="subtle" className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-500">{t('sections.interview.subtitle')}</p>
          </GlassCard>
        ) : (
          filteredQuestions.map((q, index) => (
            <GlassCard 
              key={q.id} 
              variant="default"
              className="cursor-pointer hover:bg-gray-900/70 transition-all"
              onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400 font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-white font-medium">{q.question}</p>
                    {expandedQuestion === q.id && (
                      <div className="mt-4 space-y-4">
                        {/* Sample Answer */}
                        <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <p className="text-xs text-emerald-400 font-medium mb-2">
                            {t('sections.interview.question.sample')}
                          </p>
                          <p className="text-sm text-gray-300">{q.sampleAnswer}</p>
                        </div>
                        
                        {/* Tips */}
                        <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            <p className="text-xs text-amber-400 font-medium">
                              {t('sections.interview.question.tips')}
                            </p>
                          </div>
                          <ul className="text-sm text-gray-300 space-y-1">
                            {q.tips.map((tip, i) => (
                              <li key={i}>• {tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {expandedQuestion === q.id 
                  ? <ChevronUp className="w-5 h-5 text-gray-400" />
                  : <ChevronDown className="w-5 h-5 text-gray-400" />
                }
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
```

### Cover Letter Section
Create file: `src/components/sections/CoverLetterSection.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { Mail, Copy, Download, RefreshCw, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CoverLetterSectionProps {
  onGenerate: (params: {
    company: string;
    position: string;
    tone: string;
  }) => Promise<string>;
  isGenerating: boolean;
}

export function CoverLetterSection({
  onGenerate,
  isGenerating,
}: CoverLetterSectionProps) {
  const { t } = useTranslation();
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [tone, setTone] = useState('professional');
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tones = [
    { id: 'professional', label: t('sections.coverLetter.inputs.tones.professional') },
    { id: 'friendly', label: t('sections.coverLetter.inputs.tones.friendly') },
    { id: 'confident', label: t('sections.coverLetter.inputs.tones.confident') },
    { id: 'enthusiastic', label: t('sections.coverLetter.inputs.tones.enthusiastic') },
  ];

  const handleGenerate = async () => {
    if (!company || !position) return;
    const letter = await onGenerate({ company, position, tone });
    setCoverLetter(letter);
  };

  const handleCopy = async () => {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.coverLetter.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.coverLetter.subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <GlassInput
            label={t('sections.coverLetter.inputs.company')}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g., Saudi Aramco"
          />

          <GlassInput
            label={t('sections.coverLetter.inputs.position')}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g., Senior Data Analyst"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {t('sections.coverLetter.inputs.tone')}
            </label>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    tone === t.id
                      ? 'bg-pink-500 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <GlassButton
            onClick={handleGenerate}
            isLoading={isGenerating}
            disabled={!company || !position}
            className="w-full mt-4"
            leftIcon={<Mail className="w-4 h-4" />}
          >
            {t('sections.coverLetter.generate')}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Result Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {t('sections.coverLetter.result.title')}
          </h3>
          {coverLetter && (
            <div className="flex gap-2">
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? t('common.copied') : t('common.copy')}
              </GlassButton>
              <GlassButton
                variant="ghost"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
              >
                {t('common.download')}
              </GlassButton>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleGenerate}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                {t('sections.coverLetter.result.regenerate')}
              </GlassButton>
            </div>
          )}
        </div>

        {coverLetter ? (
          <div className="p-4 bg-white/5 rounded-xl max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
              {coverLetter}
            </pre>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('sections.coverLetter.subtitle')}</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
```

### Bulk Analysis Section
Create file: `src/components/sections/BulkAnalysisSection.tsx`
```typescript
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { 
  Files, 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Download 
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface FileAnalysis {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  score?: number;
  error?: string;
}

interface BulkAnalysisSectionProps {
  onAnalyze: (files: File[]) => Promise<void>;
  results: FileAnalysis[];
  isProcessing: boolean;
}

export function BulkAnalysisSection({
  onAnalyze,
  results,
  isProcessing,
}: BulkAnalysisSectionProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 10,
  });

  const handleAnalyze = () => {
    if (files.length > 0) {
      onAnalyze(files);
    }
  };

  const getStatusIcon = (status: FileAnalysis['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="w-4 h-4 text-gray-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upload Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Files className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.bulkAnalysis.upload.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.bulkAnalysis.upload.subtitle')}
            </p>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
            isDragActive
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-white/20 hover:border-indigo-500/50'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="text-white mb-1">
            {isDragActive ? 'Drop files here' : t('sections.bulkAnalysis.upload.subtitle')}
          </p>
          <p className="text-sm text-gray-500">
            {t('sections.bulkAnalysis.upload.limit')}
          </p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white truncate max-w-[200px]">
                    {file.name}
                  </span>
                </div>
                <button
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  className="text-gray-500 hover:text-red-400"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <GlassButton
          onClick={handleAnalyze}
          disabled={files.length === 0 || isProcessing}
          isLoading={isProcessing}
          className="w-full mt-4"
        >
          Analyze {files.length} file{files.length !== 1 ? 's' : ''}
        </GlassButton>
      </GlassCard>

      {/* Results Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">
            {t('sections.bulkAnalysis.results.title')}
          </h3>
          {results.some(r => r.status === 'complete') && (
            <GlassButton
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
            >
              {t('sections.bulkAnalysis.export.csv')}
            </GlassButton>
          )}
        </div>

        {results.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Files className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Upload files to see results</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <div 
                key={result.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border transition-all',
                  result.status === 'complete' 
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : result.status === 'failed'
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-white/5 border-white/10'
                )}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <span className="text-white">{result.name}</span>
                </div>
                {result.status === 'complete' && result.score !== undefined && (
                  <span className={cn(
                    'text-lg font-bold',
                    result.score >= 80 ? 'text-emerald-400' :
                    result.score >= 60 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {result.score}%
                  </span>
                )}
                {result.status === 'failed' && (
                  <span className="text-sm text-red-400">{result.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
```

## Step 5: Install Required Dependencies

```bash
npm install react-dropzone
```

## Step 6: Create Utility Functions

Create file: `src/lib/utils.ts`
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Summary: Files to Create/Update

### New Files:
1. `src/lib/styles/glass.ts` - Glass design system
2. `src/components/ui/GlassCard.tsx` - Reusable glass card
3. `src/components/ui/GlassButton.tsx` - Reusable glass button
4. `src/components/ui/GlassInput.tsx` - Reusable glass input
5. `src/components/ui/GlassTabs.tsx` - Reusable glass tabs
6. `src/components/sections/UploadCard.tsx` - Fixed upload card
7. `src/components/sections/MatchSection.tsx` - Match section
8. `src/components/sections/OptimizeSection.tsx` - Optimize section
9. `src/components/sections/KeywordsSection.tsx` - Keywords section
10. `src/components/sections/InterviewSection.tsx` - Interview section
11. `src/components/sections/CoverLetterSection.tsx` - Cover letter section
12. `src/components/sections/BulkAnalysisSection.tsx` - Bulk analysis section

### Update Files:
1. `src/locales/en.json` - Add section translations
2. `src/locales/ar.json` - Add Arabic translations

### Install:
```bash
npm install react-dropzone
```

## Design Tokens Applied

All components now use:
- `bg-gray-900/60 backdrop-blur-xl` - Primary glass background
- `border-white/10` - Subtle borders
- `rounded-xl` or `rounded-2xl` - Consistent corners
- `shadow-xl` - Elevation
- Emerald as primary accent color
- Consistent spacing (p-6, gap-6, mb-6)
