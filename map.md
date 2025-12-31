# Resume Customizer - File Structure Map

## Project Overview
A comprehensive resume customization tool with AI-powered features for the Saudi job market, built with React, TypeScript, and Netlify Functions.

---

## Root Directory

```
resume-customizer/
├── 📄 Configuration Files
│   ├── .env                          # Environment variables
│   ├── .gitattributes                # Git attributes
│   ├── .gitignore                    # Git ignore patterns
│   ├── .mcp.json                     # MCP configuration
│   ├── eslint.config.js              # ESLint configuration
│   ├── netlify.toml                  # Netlify deployment config
│   ├── package.json                  # Node dependencies & scripts
│   ├── package-lock.json             # Locked dependency versions
│   ├── tailwind.config.ts            # Tailwind CSS configuration
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── vite.config.js                # Vite build configuration
│   └── vitest.config.ts              # Vitest test configuration
│
├── 📄 Documentation
│   ├── CLAUDE.md                     # Claude-specific instructions
│   ├── LICENSE                       # MIT License
│   ├── README.md                     # Project documentation
│   └── map.md                        # File structure map (this file)
│
├── 📁 .claude/                       # Claude code editor artifacts
├── 📁 .github/                       # GitHub workflows & configs
├── 📁 .husky/                        # Git hooks configuration
├── 📁 .netlify/                      # Netlify build artifacts
├── 📁 .vscode/                       # VS Code settings
├── 📁 dist/                          # Production build output
├── 📁 node_modules/                  # Node dependencies
└── 📄 index.html                     # HTML entry point
```

---

## Source Directory (`src/`)

### Main Application Files
```
src/
├── App.tsx                           # Main application component
├── main.tsx                          # Application entry point
├── index.css                         # Global styles with animations
└── vite-env.d.ts                     # Vite type definitions
```

### Components (`src/components/`)

#### Layout Components (`components/Layout/`)
```
Layout/
├── Footer.tsx                        # Footer component
├── Header.tsx                        # Main header with navigation
└── MainContent.tsx                   # Main content layout & routing
```

#### Section Components (`components/sections/`)
```
sections/
├── BulkAnalysisSection.tsx          # Bulk resume analysis feature
├── CoverLetterSection.tsx           # Cover letter generation
├── FeaturesShowcase.tsx             # Features showcase/landing section
├── InterviewSection.tsx             # Interview prep & questions
├── MatchSection.skeleton.tsx        # Match section loading skeleton
├── MatchSection.tsx                 # Job-resume matching analysis
├── OptimizationResultsSummary.tsx   # Optimization results summary view
├── OptimizeSection.skeleton.tsx     # Optimize section loading skeleton
├── OptimizeSection.tsx              # Resume optimization
├── PricingSection.tsx               # Pricing plans & features
├── TemplatesSection.skeleton.tsx    # Templates section loading skeleton
├── TemplatesSection.tsx             # Template gallery & export
└── UploadSection.tsx                # Resume upload interface
```

#### UI Components (`components/ui/`)
```
ui/
├── AnimatedCard.tsx                 # Animated card with glass effect
├── AnimatedCounter.tsx              # Animated number counter
├── BottomSheet.tsx                  # Mobile bottom sheet component
├── EmptyState.tsx                   # Empty state placeholder
├── EnvironmentBadge.tsx             # Environment indicator badge
├── FeedbackButtons.tsx              # User feedback buttons component
├── GlassButton.tsx                  # Glass morphism button
├── GlassCard.tsx                    # Glass morphism card
├── GlassCircle.tsx                  # Glass morphism circular component
├── GlassInput.tsx                   # Glass morphism input
├── GlassTabs.tsx                    # Glass morphism tabs
├── LanguageSwitcher.tsx             # Language toggle (EN/AR)
├── OfflineIndicator.tsx             # Offline status indicator
├── ParallaxSection.tsx              # Parallax scroll section
├── ProgressBar.tsx                  # Progress indicator
├── RateLimitBanner.tsx              # Rate limit warning banner
├── SectionTitle.tsx                 # Section header component
├── Skeleton.tsx                     # Loading skeleton component
├── Toast.tsx                        # Toast notification system
├── Tooltip.tsx                      # Tooltip component
├── UploadCard.tsx                   # Resume upload card
├── ViewTextModal.tsx                # Text viewer modal
├── Vision2030Modal.tsx              # Vision 2030 info modal
└── Vision2030Summary.tsx            # Vision 2030 summary display
```

#### Template Components (`components/templates/`)
```
templates/
├── BaseTemplate.tsx                 # Base template foundation
├── ClassicTraditional.tsx           # Classic professional template
├── ModernProfessional.tsx           # Modern professional template
├── TechnicalEngineer.tsx            # Technical engineer resume template
├── TemplateRenderer.tsx             # Template rendering logic
├── index.ts                         # Template exports
├── registry.ts                      # Template registry & metadata
└── pdf/                             # PDF export templates
    ├── ClassicTraditionalPDF.tsx    # Classic template PDF version
    ├── ModernProfessionalPDF.tsx    # Modern template PDF version
    ├── TechnicalEngineerPDF.tsx     # Technical template PDF version
    ├── index.ts                     # PDF template exports
    └── shared.ts                    # Shared PDF styles & utilities
```

#### Other Component Directories
```
analysis/
└── ATSAnalyzer.tsx                  # ATS compatibility analyzer

compliance/
├── ConsentBanner.tsx                # GDPR/privacy consent banner
└── PrivacySettings.tsx              # Privacy settings panel

demo/
└── Vision2030Demo.tsx               # Vision 2030 interactive demo

providers/
└── AnalyticsProvider.tsx            # Analytics context provider

shared/
├── CommonComponents.tsx             # Shared common components
├── ErrorBoundary.tsx                # Error boundary wrapper
└── OptimizationCard.tsx             # Optimization suggestion card
```

---

### Library (`src/lib/`)

#### Core Files
```
lib/
├── assets.ts                        # Static asset utilities
├── assets.test.ts                   # Asset utilities tests
├── i18n.ts                          # Internationalization config
└── resumeText.d.ts                  # Resume text type definitions
```

#### Data (`lib/data/`)
```
data/
├── exampleResume.ts                 # Example resume data for demos
├── resumeTemplates.ts               # Resume template configurations
└── vision2030Skills.ts              # Vision 2030 skills & competencies
```

#### Stores (`lib/stores/`)
```
stores/
├── consentStore.ts                  # User consent state management
├── feedbackStore.ts                 # User feedback state management
└── resumeStore.ts                   # Resume data state management
```

#### Styles (`lib/styles/`)
```
styles/
└── templateStyles.ts                # Template-specific styles
```

#### Utilities (`lib/utils/`)
```
utils/
├── __tests__/                       # Utility tests
│   ├── normalize-resume.test.ts     # Resume normalization tests
│   ├── resumeUtils.test.ts          # Resume utilities tests
│   └── vision2030Analyzer.test.ts   # Vision 2030 analyzer tests
├── apiStatus.ts                     # API health check utilities
├── arabicKeywordMatcher.ts          # Arabic keyword matching
├── arabicTextUtils.ts               # Arabic text utilities
├── cn.ts                            # Class name utilities
├── pdfExport.ts                     # PDF export utilities
├── resumeText.ts                    # Resume text processing
├── resumeUtils.ts                   # Resume data transformation
├── vision2030Analyzer.ts            # Vision 2030 analysis
└── vision2030Icons.tsx              # Vision 2030 sector icons
```

#### Validation (`lib/validation/`)
```
validation/
├── parsingWarnings.ts               # Resume parsing warning utilities
└── store-schemas.ts                 # Zod schemas for state validation

---

### Services (`src/services/`)
```
services/
├── analytics.ts                     # Analytics tracking service
├── api.js                           # API client & endpoints
├── api.test.js                      # API service tests
├── exportPdf.js                     # PDF export service
├── exportPdf.test.js                # PDF export tests
├── feedback.ts                      # User feedback service
├── keywordAnalyzer.js               # Keyword analysis service
├── supabase.js                      # Supabase client & utilities
└── supabaseExport.js                # Supabase export utilities
```

---

### Other Directories

#### Hooks (`src/hooks/`)
```
hooks/
├── useAuth.tsx                      # Authentication hook
├── useKeywordAnalysis.js            # Keyword analysis hook
├── useRateLimit.ts                  # Rate limiting hook
└── useTheme.js                      # Theme management hook
```

#### Pages (`src/pages/`)
```
pages/
├── Home.tsx                         # Home page component
└── NotFound.tsx                     # 404 error page
```

#### Locales (`src/locales/`)
```
locales/
├── ar.json                          # Arabic translations
└── en.json                          # English translations
```

#### Types (`src/types/`)
```
types/
├── index.ts                         # Shared TypeScript types
├── resume.d.ts                      # Resume type definitions
└── templates.ts                     # Template type definitions
```

#### Tests (`src/__tests__/`)
```
__tests__/
├── JobMatch.test.jsx                 # Job matching tests
├── MainContent.test.jsx              # Main content tests
├── OptimizeSection.test.jsx          # Optimize section tests
├── ResumeUpload.test.jsx             # Resume upload tests
├── TemplatesSection.test.jsx         # Templates section tests
├── matchScore.fixture.test.js        # Match score fixture tests
├── resumeText.test.js                # Resume text utils tests
├── smoke.test.jsx                    # Smoke tests
├── supabase.test.js                  # Supabase integration tests
└── useAuth.test.jsx                  # Auth hook tests
```

#### Test Utilities (`src/test/`)
```
test/
├── setup.ts                         # Test setup & configuration
└── test-utils.tsx                   # Testing utilities & helpers
```

---

## Netlify Functions (`netlify/`)

### Functions (`netlify/functions/`)
```
functions/
├── ai-match.ts                      # AI-powered job matching
├── batch-api.ts                     # Batch processing API
├── delete-user-data.ts              # GDPR data deletion
├── export-user-data.ts              # GDPR data export
├── extract-resume-json.ts           # Resume JSON extraction
├── generate-cover-letter.ts         # Cover letter generation
├── optimize.ts                      # Resume optimization
├── parse-arabic-resume.ts           # Arabic resume parsing
├── parse-resume.ts                  # Resume parsing (OCR)
└── predict-questions.ts             # Interview question prediction
```

### Shared Libraries (`netlify/lib/`)
```
lib/
├── gemini-client.js                 # Google Gemini AI client
├── normalize-resume.js              # Resume normalization utilities
├── rate-limiter.ts                  # Rate limiting middleware
├── resume-schemas.ts                # Zod resume validation schemas
├── resumeText.js                    # Resume text processing
└── sentry.ts                        # Sentry error tracking
```

### Netlify Function Tests (`netlify/functions/__tests__/`)
```
__tests__/
├── ai-integration.test.ts           # AI integration tests
├── extract-resume-json.test.ts      # Resume extraction tests
├── optimize.test.ts                 # Optimization function tests
├── parse-resume.test.ts             # Resume parsing tests
└── resume-schemas.test.ts           # Schema validation tests
```

---

## Public Assets (`public/`)
```
public/
├── _headers                         # HTTP headers configuration
├── favicon.svg                      # Site favicon (SVG)
└── og-image.png                     # Open Graph social media image
```

---

## Scripts (`scripts/`)
```
scripts/
├── analyze-bundle.js                # Bundle size analyzer
├── check-env.js                     # Environment validation
├── clean.js                         # Clean build artifacts
├── deploy.js                        # Deployment script
└── test-ci.js                       # CI test runner
```

---

## Key Features by Directory

### 🎨 **UI/UX**
- Glass morphism design system (`components/ui/Glass*.tsx`)
- Animated components with smooth transitions
- Responsive layout with mobile support
- Dark mode with vibrant color palette

### 🤖 **AI Features**
- Resume parsing with OCR (`netlify/functions/parse-resume.ts`)
- Job matching analysis (`netlify/functions/ai-match.ts`)
- Resume optimization (`netlify/functions/optimize.ts`)
- Interview question prediction (`netlify/functions/predict-questions.ts`)
- Cover letter generation (`netlify/functions/generate-cover-letter.ts`)

### 🇸🇦 **Saudi Market Focus**
- Arabic language support (RTL)
- Vision 2030 alignment analysis
- Saudi industry categories
- Bilingual interface (AR/EN)

### 📊 **Analytics & Compliance**
- GDPR compliance (`components/compliance/`)
- Privacy controls
- Analytics tracking
- Error reporting

### 🧪 **Testing**
- Component tests with Vitest
- Test utilities and helpers
- Comprehensive test coverage

### 🚀 **Performance**
- Vite build optimization
- Code splitting & lazy loading
- Bundle size monitoring
- Performance tracking

---

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Custom CSS Animations
- **Build Tool**: Vite
- **Testing**: Vitest + Testing Library
- **Backend**: Netlify Functions (Serverless)
- **AI**: Gemini API
- **PDF**: @react-pdf/renderer
- **State**: Zustand
- **i18n**: Custom implementation
- **Deployment**: Netlify

---

*Last updated: December 31, 2025 at 10:05 UTC+3*
