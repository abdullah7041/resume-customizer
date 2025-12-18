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
│   ├── AI_INSTRUCTIONS.md            # AI development guidelines
│   ├── CLAUDE.md                     # Claude-specific instructions
│   ├── LICENSE                       # MIT License
│   ├── README.md                     # Project documentation
│   └── map.md                        # File structure map (this file)
│
├── 📁 .claude/                       # Claude code editor artifacts
├── 📁 .github/                       # GitHub workflows & configs
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
├── InterviewSection.tsx             # Interview prep & questions
├── KeywordsSection.tsx              # Keyword analysis & suggestions
├── MatchSection.tsx                 # Job-resume matching analysis
├── OptimizeSection.tsx              # Resume optimization
├── PricingSection.tsx               # Pricing plans & features
├── TemplatesSection.tsx             # Template gallery & export
└── UploadSection.tsx                # Resume upload interface
```

#### UI Components (`components/ui/`)
```
ui/
├── AnimatedCard.tsx                 # Animated card with glass effect
├── AnimatedCounter.tsx              # Animated number counter
├── BottomSheet.tsx                  # Mobile bottom sheet component
├── Button.tsx                       # Reusable button component
├── Card.tsx                         # Basic card component
├── EmptyState.tsx                   # Empty state placeholder
├── EnvironmentBadge.tsx             # Environment indicator badge
├── GlassButton.tsx                  # Glass morphism button
├── GlassCard.tsx                    # Glass morphism card
├── GlassInput.tsx                   # Glass morphism input
├── GlassTabs.tsx                    # Glass morphism tabs
├── HelpModal.tsx                    # Help/info modal
├── Input.tsx                        # Reusable input component
├── LanguageSwitcher.tsx             # Language toggle (EN/AR)
├── OfflineIndicator.tsx             # Offline status indicator
├── ParallaxSection.tsx              # Parallax scroll section
├── ProgressBar.tsx                  # Progress indicator
├── SectionTitle.tsx                 # Section header component
├── Tabs.tsx                         # Tab navigation component
├── Toast.tsx                        # Toast notification system
├── Tooltip.tsx                      # Tooltip component
├── UploadCard.tsx                   # Resume upload card
├── ViewTextModal.tsx                # Text viewer modal
├── Vision2030Modal.tsx              # Vision 2030 info modal
└── WelcomeModal.tsx                 # Welcome/onboarding modal
```

#### Template Components (`components/templates/`)
```
templates/
├── ATSClassic.tsx                   # ATS-optimized classic template
├── BaseATSTemplate.tsx              # Base ATS template logic
├── BaseTemplate.tsx                 # Base template foundation
├── ClassicTraditional.tsx           # Classic professional template
├── ModernProfessional.tsx           # Modern professional template
├── ModernTemplate.tsx               # Modern design template
├── ResumePDFDocument.tsx            # PDF export using @react-pdf
├── ResumePreview.tsx                # Resume preview component
├── TechnicalTemplate.tsx            # Technical resume template
├── TemplateRenderer.tsx             # Template rendering logic
├── TemplateSelector.tsx             # Template selection UI
├── index.ts                         # Template exports
└── registry.ts                      # Template registry & metadata
```

#### Other Component Directories
```
analysis/
└── ATSAnalyzer.tsx                  # ATS compatibility analyzer

compliance/
├── ConsentBanner.tsx                # GDPR/privacy consent banner
└── PrivacySettings.tsx              # Privacy settings panel

providers/
└── AnalyticsProvider.tsx            # Analytics context provider

shared/
├── ErrorBoundary.tsx                # Error boundary wrapper
└── LoadingSpinner.tsx               # Loading spinner component
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
├── industries.ts                    # Saudi industry categories
├── keywords.ts                      # Job keyword database
└── vision2030.ts                    # Vision 2030 data & sectors
```

#### Stores (`lib/stores/`)
```
stores/
├── consentStore.ts                  # User consent state management
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
├── apiStatus.ts                     # API health check utilities
├── arabicKeywordMatcher.ts          # Arabic keyword matching
├── arabicPdfExtractor.ts            # Arabic PDF text extraction
├── arabicResumeParser.ts            # Arabic resume parsing
├── arabicTextUtils.ts               # Arabic text utilities
├── cn.ts                            # Class name utilities
├── pdfExport.ts                     # PDF export utilities
├── resumeText.ts                    # Resume text processing
├── resumeUtils.ts                   # Resume data transformation
├── templatePreviews.ts              # Template preview generation
└── vision2030Analyzer.ts            # Vision 2030 analysis
```

---

### Services (`src/services/`)
```
services/
├── analytics.ts                     # Analytics tracking service
├── api.js                           # API client & endpoints
├── api.test.js                      # API service tests
├── exportPdf.js                     # PDF export service
├── exportPdf.test.js                # PDF export tests
├── keywordAnalyzer.js               # Keyword analysis service
├── supabase.js                      # Supabase client & utilities
└── supabaseExport.js                # Supabase export utilities
```

---

### Other Directories

#### Hooks (`src/hooks/`)
```
hooks/
├── useApi.ts                        # API call hook
├── useInView.ts                     # Intersection observer hook
├── useLocalStorage.ts               # Local storage hook
└── useToast.tsx                     # Toast notification hook
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
└── resume.ts                        # Resume-specific types
```

#### Tests (`src/__tests__/`)
```
__tests__/
├── ATSClassic.test.jsx               # ATS template tests
├── Button.test.jsx                   # Button component tests
├── Header.test.jsx                   # Header component tests
├── JobMatch.test.jsx                 # Job matching tests
├── MainContent.test.jsx              # Main content tests
├── ResumeUpload.test.jsx             # Resume upload tests
├── SectionTitle.test.jsx             # Section title tests
├── UploadCard.test.jsx               # Upload card tests
├── matchScore.fixture.test.js        # Match score fixture tests
├── mobile-layout.test.jsx            # Mobile layout tests
├── resumeText.test.js                # Resume text utils tests
├── shimmer-animations.test.ts        # Shimmer animation tests
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
├── match-score.ts                   # Resume-job match scoring
├── optimize.ts                      # Resume optimization
├── parse-arabic-resume.ts           # Arabic resume parsing
├── parse-resume.ts                  # Resume parsing (OCR)
└── predict-questions.ts             # Interview question prediction
```

### Shared Libraries (`netlify/lib/`)
```
lib/
├── rateLimit.ts                     # Rate limiting middleware
├── rateLimitMiddleware.ts           # Rate limit wrapper
├── resumeSchema.ts                  # Zod resume validation schema
├── upstashClient.ts                 # Upstash Redis client
└── validation.ts                    # Input validation utilities
```

---

## Public Assets (`public/`)
```
public/
├── favicon.ico                      # Site favicon
└── logo.png                         # Application logo
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
- **AI**: OpenAI API
- **PDF**: @react-pdf/renderer
- **State**: Zustand
- **i18n**: Custom implementation
- **Deployment**: Netlify

---

*Last updated: December 18, 2025 at 20:14 UTC+3*
