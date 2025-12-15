# Claude Code Instruction: Arabic RTL Support for Resume Customizer

## Context
You are implementing Arabic language and RTL (Right-to-Left) layout support for a React + Vite + Tailwind CSS v4 application. This is a resume optimization SaaS targeting the Saudi Arabian market.

## Project Structure Reference
```
resume-customizer/
├── src/
│   ├── app/ or pages/
│   ├── components/
│   ├── lib/
│   └── main.tsx
├── public/
├── index.html
├── tailwind.config.ts
├── vite.config.js
└── package.json
```

## Step 1: Install Dependencies

Run this command first:
```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

## Step 2: Create i18n Configuration

Create file: `src/lib/i18n.ts`
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en.json';
import ar from '../locales/ar.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

## Step 3: Create Translation Files

Create file: `src/locales/en.json`
```json
{
  "common": {
    "appName": "AI Resume Optimizer",
    "upload": "Upload Resume",
    "analyze": "Analyze",
    "optimize": "Optimize",
    "export": "Export PDF",
    "loading": "Loading...",
    "error": "An error occurred",
    "retry": "Try Again",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "close": "Close"
  },
  "nav": {
    "home": "Home",
    "dashboard": "Dashboard",
    "pricing": "Pricing",
    "login": "Login",
    "signup": "Sign Up",
    "logout": "Logout"
  },
  "landing": {
    "hero": {
      "title": "Transform Your Resume with AI",
      "subtitle": "Get more interviews with an ATS-optimized resume tailored for the Saudi job market",
      "cta": "Start Free Analysis"
    },
    "features": {
      "ats": {
        "title": "ATS Compliance Check",
        "description": "Ensure your resume passes Applicant Tracking Systems"
      },
      "match": {
        "title": "Job Match Score",
        "description": "See how well your resume matches any job description"
      },
      "optimize": {
        "title": "AI Optimization",
        "description": "Get intelligent suggestions to improve your resume"
      }
    },
    "trust": {
      "resumes": "Resumes Optimized",
      "score": "Average Score Improvement",
      "users": "Happy Users"
    }
  },
  "upload": {
    "title": "Upload Your Resume",
    "dragDrop": "Drag and drop your file here",
    "or": "or",
    "browse": "Browse Files",
    "supported": "Supported formats: PDF, DOCX",
    "maxSize": "Maximum file size: 5MB",
    "paste": "Or paste your resume text"
  },
  "analysis": {
    "title": "Resume Analysis",
    "matchScore": "Match Score",
    "atsScore": "ATS Score",
    "keywords": {
      "title": "Keywords",
      "found": "Found",
      "missing": "Missing"
    },
    "skills": {
      "title": "Skills Gap Analysis",
      "matched": "Matched Skills",
      "missing": "Missing Skills"
    }
  },
  "optimize": {
    "title": "AI Optimization",
    "suggestions": "Suggestions",
    "apply": "Apply Suggestion",
    "applyAll": "Apply All",
    "original": "Original",
    "optimized": "Optimized",
    "generating": "Generating optimizations..."
  },
  "export": {
    "title": "Export Resume",
    "styled": "Styled PDF",
    "ats": "ATS-Friendly PDF",
    "downloading": "Preparing download..."
  },
  "pricing": {
    "title": "Simple Pricing",
    "subtitle": "Start free, upgrade when you need more",
    "free": {
      "name": "Free",
      "price": "0",
      "period": "forever",
      "features": [
        "3 resume analyses per month",
        "Basic ATS score",
        "Keyword matching"
      ],
      "cta": "Get Started"
    },
    "pro": {
      "name": "Pro",
      "price": "49",
      "period": "per month",
      "features": [
        "Unlimited analyses",
        "AI-powered optimization",
        "PDF export",
        "Priority support"
      ],
      "cta": "Start Pro Trial"
    },
    "currency": "SAR"
  },
  "auth": {
    "login": {
      "title": "Welcome Back",
      "email": "Email",
      "password": "Password",
      "submit": "Login",
      "noAccount": "Don't have an account?",
      "signupLink": "Sign up"
    },
    "signup": {
      "title": "Create Account",
      "name": "Full Name",
      "email": "Email",
      "password": "Password",
      "confirmPassword": "Confirm Password",
      "submit": "Create Account",
      "hasAccount": "Already have an account?",
      "loginLink": "Login"
    }
  },
  "footer": {
    "tagline": "AI-Powered Resume Optimization for Saudi Arabia",
    "links": {
      "privacy": "Privacy Policy",
      "terms": "Terms of Service",
      "contact": "Contact Us"
    },
    "copyright": "© 2024 AI Resume Optimizer. All rights reserved."
  }
}
```

Create file: `src/locales/ar.json`
```json
{
  "common": {
    "appName": "محسّن السيرة الذاتية بالذكاء الاصطناعي",
    "upload": "رفع السيرة الذاتية",
    "analyze": "تحليل",
    "optimize": "تحسين",
    "export": "تصدير PDF",
    "loading": "جاري التحميل...",
    "error": "حدث خطأ",
    "retry": "حاول مجدداً",
    "cancel": "إلغاء",
    "save": "حفظ",
    "delete": "حذف",
    "edit": "تعديل",
    "close": "إغلاق"
  },
  "nav": {
    "home": "الرئيسية",
    "dashboard": "لوحة التحكم",
    "pricing": "الأسعار",
    "login": "تسجيل الدخول",
    "signup": "إنشاء حساب",
    "logout": "تسجيل الخروج"
  },
  "landing": {
    "hero": {
      "title": "حوّل سيرتك الذاتية بالذكاء الاصطناعي",
      "subtitle": "احصل على المزيد من المقابلات مع سيرة ذاتية محسّنة لأنظمة ATS ومصممة لسوق العمل السعودي",
      "cta": "ابدأ التحليل المجاني"
    },
    "features": {
      "ats": {
        "title": "فحص توافق ATS",
        "description": "تأكد من اجتياز سيرتك الذاتية لأنظمة تتبع المتقدمين"
      },
      "match": {
        "title": "نسبة التوافق مع الوظيفة",
        "description": "اعرف مدى توافق سيرتك الذاتية مع أي وصف وظيفي"
      },
      "optimize": {
        "title": "تحسين بالذكاء الاصطناعي",
        "description": "احصل على اقتراحات ذكية لتحسين سيرتك الذاتية"
      }
    },
    "trust": {
      "resumes": "سيرة ذاتية محسّنة",
      "score": "متوسط تحسين النتيجة",
      "users": "مستخدم سعيد"
    }
  },
  "upload": {
    "title": "ارفع سيرتك الذاتية",
    "dragDrop": "اسحب وأفلت ملفك هنا",
    "or": "أو",
    "browse": "تصفح الملفات",
    "supported": "الصيغ المدعومة: PDF، DOCX",
    "maxSize": "الحجم الأقصى: 5 ميجابايت",
    "paste": "أو الصق نص سيرتك الذاتية"
  },
  "analysis": {
    "title": "تحليل السيرة الذاتية",
    "matchScore": "نسبة التوافق",
    "atsScore": "نتيجة ATS",
    "keywords": {
      "title": "الكلمات المفتاحية",
      "found": "موجودة",
      "missing": "مفقودة"
    },
    "skills": {
      "title": "تحليل فجوة المهارات",
      "matched": "المهارات المتوافقة",
      "missing": "المهارات المفقودة"
    }
  },
  "optimize": {
    "title": "التحسين بالذكاء الاصطناعي",
    "suggestions": "الاقتراحات",
    "apply": "تطبيق الاقتراح",
    "applyAll": "تطبيق الكل",
    "original": "الأصلي",
    "optimized": "المحسّن",
    "generating": "جاري إنشاء التحسينات..."
  },
  "export": {
    "title": "تصدير السيرة الذاتية",
    "styled": "PDF منسّق",
    "ats": "PDF متوافق مع ATS",
    "downloading": "جاري تحضير التنزيل..."
  },
  "pricing": {
    "title": "أسعار بسيطة",
    "subtitle": "ابدأ مجاناً، وقم بالترقية عند الحاجة",
    "free": {
      "name": "مجاني",
      "price": "0",
      "period": "للأبد",
      "features": [
        "3 تحليلات شهرياً",
        "نتيجة ATS أساسية",
        "مطابقة الكلمات المفتاحية"
      ],
      "cta": "ابدأ الآن"
    },
    "pro": {
      "name": "احترافي",
      "price": "49",
      "period": "شهرياً",
      "features": [
        "تحليلات غير محدودة",
        "تحسين بالذكاء الاصطناعي",
        "تصدير PDF",
        "دعم أولوية"
      ],
      "cta": "ابدأ النسخة التجريبية"
    },
    "currency": "ريال"
  },
  "auth": {
    "login": {
      "title": "مرحباً بعودتك",
      "email": "البريد الإلكتروني",
      "password": "كلمة المرور",
      "submit": "تسجيل الدخول",
      "noAccount": "ليس لديك حساب؟",
      "signupLink": "إنشاء حساب"
    },
    "signup": {
      "title": "إنشاء حساب جديد",
      "name": "الاسم الكامل",
      "email": "البريد الإلكتروني",
      "password": "كلمة المرور",
      "confirmPassword": "تأكيد كلمة المرور",
      "submit": "إنشاء الحساب",
      "hasAccount": "لديك حساب بالفعل؟",
      "loginLink": "تسجيل الدخول"
    }
  },
  "footer": {
    "tagline": "تحسين السيرة الذاتية بالذكاء الاصطناعي للمملكة العربية السعودية",
    "links": {
      "privacy": "سياسة الخصوصية",
      "terms": "شروط الخدمة",
      "contact": "اتصل بنا"
    },
    "copyright": "© 2024 محسّن السيرة الذاتية بالذكاء الاصطناعي. جميع الحقوق محفوظة."
  }
}
```

## Step 4: Create RTL Context Provider

Create file: `src/components/providers/DirectionProvider.tsx`
```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Direction = 'ltr' | 'rtl';

interface DirectionContextType {
  direction: Direction;
  isRTL: boolean;
  toggleLanguage: () => void;
  setLanguage: (lang: 'en' | 'ar') => void;
  currentLanguage: string;
}

const DirectionContext = createContext<DirectionContextType | undefined>(undefined);

export function DirectionProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [direction, setDirection] = useState<Direction>('ltr');

  useEffect(() => {
    const isArabic = i18n.language === 'ar';
    const dir = isArabic ? 'rtl' : 'ltr';
    
    setDirection(dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
    
    // Update font family for Arabic
    if (isArabic) {
      document.documentElement.style.setProperty('--font-family', "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif");
    } else {
      document.documentElement.style.setProperty('--font-family', "'Inter', sans-serif");
    }
  }, [i18n.language]);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const setLanguage = (lang: 'en' | 'ar') => {
    i18n.changeLanguage(lang);
  };

  return (
    <DirectionContext.Provider
      value={{
        direction,
        isRTL: direction === 'rtl',
        toggleLanguage,
        setLanguage,
        currentLanguage: i18n.language,
      }}
    >
      {children}
    </DirectionContext.Provider>
  );
}

export function useDirection() {
  const context = useContext(DirectionContext);
  if (!context) {
    throw new Error('useDirection must be used within a DirectionProvider');
  }
  return context;
}
```

## Step 5: Create Language Switcher Component

Create file: `src/components/ui/LanguageSwitcher.tsx`
```typescript
import { useDirection } from '../providers/DirectionProvider';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { currentLanguage, toggleLanguage } = useDirection();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
      aria-label="Toggle language"
    >
      <Globe className="w-4 h-4" />
      <span>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}
```

## Step 6: Update index.html

Add Arabic font to `index.html` inside the `<head>` tag:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

Also add to `<html>` tag:
```html
<html lang="en" dir="ltr">
```

## Step 7: Update main.tsx Entry Point

Modify `src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/i18n'; // Import i18n config

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Step 8: Wrap App with Providers

Modify `src/App.tsx`:
```typescript
import { DirectionProvider } from './components/providers/DirectionProvider';
// ... other imports

function App() {
  return (
    <DirectionProvider>
      {/* Your existing app content */}
    </DirectionProvider>
  );
}

export default App;
```

## Step 9: Update CSS for RTL Support

Add to `src/index.css`:
```css
:root {
  --font-family: 'Inter', sans-serif;
}

html {
  font-family: var(--font-family);
}

/* RTL-aware spacing utilities */
[dir="rtl"] .ml-auto { margin-left: unset; margin-right: auto; }
[dir="rtl"] .mr-auto { margin-right: unset; margin-left: auto; }

/* RTL-aware flex direction */
[dir="rtl"] .flex-row { flex-direction: row-reverse; }

/* Fix icons in RTL */
[dir="rtl"] .icon-flip {
  transform: scaleX(-1);
}

/* Arabic text improvements */
[dir="rtl"] {
  letter-spacing: 0;
  word-spacing: 0.05em;
}

/* Ensure numbers remain LTR in Arabic context */
[dir="rtl"] .ltr-numbers {
  direction: ltr;
  unicode-bidi: isolate;
}
```

## Step 10: Update Tailwind Config for RTL

Modify `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-family)', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', '"Noto Sans Arabic"', 'sans-serif'],
      },
    },
  },
  plugins: [],
  // Tailwind v4 handles RTL automatically with logical properties
  // For v3, add: plugins: [require('tailwindcss-rtl')]
} satisfies Config
```

## Step 11: Usage Examples

### Using translations in components:
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('landing.hero.title')}</h1>
      <p>{t('landing.hero.subtitle')}</p>
      <button>{t('landing.hero.cta')}</button>
    </div>
  );
}
```

### Using direction context:
```typescript
import { useDirection } from './components/providers/DirectionProvider';

function MyComponent() {
  const { isRTL, direction } = useDirection();
  
  return (
    <div className={isRTL ? 'text-right' : 'text-left'}>
      {/* Content */}
    </div>
  );
}
```

### RTL-safe icon usage:
```typescript
import { ChevronRight } from 'lucide-react';
import { useDirection } from './components/providers/DirectionProvider';

function NavigationArrow() {
  const { isRTL } = useDirection();
  
  return (
    <ChevronRight 
      className={isRTL ? 'rotate-180' : ''} 
    />
  );
}
```

## Step 12: Migrate Existing Components

For each component with text content, replace hardcoded strings:

**Before:**
```tsx
<button>Upload Resume</button>
```

**After:**
```tsx
import { useTranslation } from 'react-i18next';

function UploadButton() {
  const { t } = useTranslation();
  return <button>{t('common.upload')}</button>;
}
```

## Step 13: Testing Checklist

After implementation, verify:

1. [ ] Language switcher toggles between English and Arabic
2. [ ] All text content translates correctly
3. [ ] Layout flips to RTL when Arabic is selected
4. [ ] Forms work correctly in RTL (input direction, labels)
5. [ ] Icons that indicate direction (arrows, chevrons) flip correctly
6. [ ] Numbers and prices display correctly in Arabic context
7. [ ] PDF export respects current language setting
8. [ ] Language preference persists after page refresh

## Common RTL Gotchas

1. **Flexbox**: `flex-row` doesn't auto-reverse. Use `flex-row-reverse` for RTL or use CSS logical properties.

2. **Absolute positioning**: Replace `left/right` with `start/end` (Tailwind: `start-0` instead of `left-0`).

3. **Margins/Padding**: Use logical properties. Replace `ml-4` with `ms-4` (margin-start) in Tailwind v3+.

4. **Text alignment**: Replace `text-left/text-right` with `text-start/text-end`.

5. **Border radius**: Replace `rounded-l-lg` with `rounded-s-lg` (start) for RTL support.

## File Creation Summary

Create these files in order:
1. `src/lib/i18n.ts`
2. `src/locales/en.json`
3. `src/locales/ar.json`
4. `src/components/providers/DirectionProvider.tsx`
5. `src/components/ui/LanguageSwitcher.tsx`

Modify these files:
1. `index.html` (add fonts)
2. `src/main.tsx` (import i18n)
3. `src/App.tsx` (add DirectionProvider)
4. `src/index.css` (RTL utilities)
5. `tailwind.config.ts` (font families)

## Verification Command

After all changes, run:
```bash
npm run dev
```

Open browser, click language switcher, verify:
- UI flips to RTL
- All text appears in Arabic
- No layout breaks
