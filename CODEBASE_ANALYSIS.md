# Resume Customizer - Comprehensive Codebase Analysis

## 1. PROJECT OVERVIEW

**Project Name**: AI Resume Optimizer (resume-customizer)  
**Type**: Full-Stack Web Application  
**Primary Purpose**: AI-powered resume optimization platform designed for the Saudi Arabia job market  
**Tech Stack**: React 19 + TypeScript + Vite + Netlify Functions + Supabase

---

## 2. OVERALL PROJECT STRUCTURE

### Root Level Organization
```
resume-customizer/
├── src/                          # Frontend React application
├── netlify/                       # Backend serverless functions
├── public/                        # Static assets
├── scripts/                       # Build and utility scripts
├── shared/                        # Shared utilities
├── docs/                          # Documentation
├── package.json                   # Main dependencies
├── vitest.config.ts              # Testing configuration
├── vite.config.js                # Build configuration
├── tsconfig.json                 # TypeScript configuration
└── index.html                    # Main entry point
```

**Architecture Type**: Full-stack monorepo with separated frontend and serverless backend

---

## 3. FRONTEND STRUCTURE (src/)

### Key Directories

#### `/src/components/` - React Components (6 subdirectories)
**Purpose**: Reusable UI components organized by feature and type

- **`/ui/`** - Atomic UI components (15 files)
  - Button.jsx, Input.jsx, Card.jsx, Tabs.jsx, Tooltip.jsx
  - AnimatedCard.jsx, AnimatedCounter.jsx
  - UploadCard.jsx, MagneticButton.jsx
  - HelpModal.jsx, Toast.jsx, EmptyState.jsx
  - ParallaxSection.jsx, SectionTitle.jsx, OcrBadge.jsx

- **`/Layout/`** - Page layout components (2 files)
  - Header.jsx - Navigation and hero section
  - Footer.jsx - Footer component

- **`/Features/`** - Feature-specific components (1 file)
  - JobMatch.jsx - Job matching analysis display

- **`/shared/`** - Shared composite components
  - CommonComponents.jsx
  - OptimizationCard.jsx

- **Root component files**:
  - MainContent.jsx - Main app content area
  - LandingPage.jsx & LandingPageV2.jsx - Landing pages
  - TemplateRenderer.jsx - Resume template rendering
  - WelcomeModal.jsx - Onboarding modal
  - ProgressBar.jsx - Progress indicator
  - TestButton.tsx - Test/debug button

#### `/src/features/` - Feature Modules (7 files)
**Purpose**: Larger feature components for major app sections

- BulkAnalysis.jsx (14.7 KB) - Compare multiple resume versions
- CoverLetter.jsx (12.7 KB) - Generate cover letters
- Optimization.jsx (7.5 KB) - Resume optimization UI
- KeywordAnalyzer.jsx (10.9 KB) - Keyword analysis tool
- InterviewPrep.jsx (12.6 KB) - Interview prep questions
- ResumeUpload.jsx (11.4 KB) - Resume file upload handler
- TemplateGallery.jsx (15.5 KB) - Resume template gallery

#### `/src/hooks/` - Custom React Hooks (4 files)
**Purpose**: Reusable state logic and side effects

- `useAuth.jsx` - Authentication state and Supabase integration
- `useTheme.js` - Theme management (light/dark mode)
- `useKeywordAnalysis.js` - Keyword analysis logic
- `useTheme.test.jsx` - Theme hook tests

#### `/src/lib/` - Utility Libraries (4 files)
**Purpose**: Core utility functions and client logic

- `aiClient.ts` - AI API client with error handling
- `assets.ts` - Asset URL and image management
- `resumeText.js` - Resume text extraction utilities
- `cn.js` - ClassName utility function

#### `/src/services/` - API/Business Logic (6 files)
**Purpose**: API calls and external service integration

- `api.js` - Main API service (806 lines)
  - parseResume() - Resume text extraction
  - analyzeResume() - Job match analysis
  - optimizeResume() - AI-powered optimization
  - analyzeResumeWithAI() - AI match analysis
  - batchProcess() - Batch API operations
  - processResumeBatch() - Combined batch processing

- `supabase.js` - Supabase client initialization
- `supabaseExport.js` - Supabase export functionality
- `exportPdf.js` - PDF export functionality
- `keywordAnalyzer.js` - Keyword extraction service

#### `/src/data/` - Static Data (2 files)
- resumeTemplates.js - Resume template definitions
- helpContent.jsx - Help and guidance content

#### `/src/utils/` - Utility Functions (1 file)
- templatePreviews.js - Template preview utilities

#### `/src/styles/` - Styling
- CSS module files and style utilities

#### `/src/test/` - Test Infrastructure
- setup.ts - Vitest setup and global mocks
- __mocks__/pdfjs-dist.mjs - PDF.js mock for testing

#### `/src/assets/` - Static Assets
- Images, icons, and media files

### Core Entry Point
- **App.jsx** - Root application component
- **main.tsx** - React DOM entry point with AuthProvider wrapper
- **index.css** - Global styles

---

## 4. BACKEND STRUCTURE (netlify/functions/)

### Netlify Serverless Functions (9 TypeScript files)

**Purpose**: Serverless backend endpoints for AI processing and resume analysis

#### 1. **parse-resume.ts**
- Extracts text from PDF/DOCX files
- Uses DeepSeek OCR for image-based documents
- Normalizes resume structure
- Returns plainText, bullets, and sections

#### 2. **ai.ts**
- Generic AI completion endpoint
- Interfaces with OpenAI API
- Handles model configuration
- Supports streaming responses

#### 3. **match-score.ts**
- Calculates TF-IDF similarity scores
- Identifies missing/matched keywords
- Coverage and cosine similarity metrics
- Fallback keyword matching

#### 4. **optimize.ts**
- AI-powered resume rewriting
- Generates optimization suggestions
- Section-by-section improvements
- Multi-modal optimization (conservative/aggressive)

#### 5. **ai-match.ts**
- AI-powered match analysis
- Intelligent insights on resume-job fit
- Detailed explanations and recommendations
- Stronger AI analysis than basic matching

#### 6. **extract-resume-json.ts**
- NEW! Structured JSON extraction
- Validates against schema
- Extracts education, experience, skills
- Machine-readable resume format

#### 7. **generate-cover-letter.ts**
- Generates cover letters from resume
- Customized to job description
- Multiple tones/styles
- Follows ATS best practices

#### 8. **predict-questions.ts**
- Interview preparation
- Predicts likely interview questions
- Generates answer guidelines
- Based on resume and job description

#### 9. **batch-api.ts**
- Batch processing for multiple operations
- Concurrent execution support
- Error handling per task
- Transaction-like behavior

### Backend Library Code (netlify/lib/)

#### ai-config.ts
- OpenAI configuration resolution
- Token clamping and validation
- Model selection with fallbacks
- Environment variable handling

#### normalize-resume.js
- Resume data normalization
- Section standardization
- Bullet point extraction
- Document structure validation

#### resumeText.js (12 KB)
- PDF.js integration for text extraction
- DOCX ZIP archive handling
- MIME type inference
- UTF-8 text decoding
- Multi-format support (PDF, DOCX, TXT, images)

#### rate-limiter.ts
- API rate limiting
- Token bucket algorithm
- Per-user request throttling
- Abuse prevention

---

## 5. TESTING INFRASTRUCTURE

### Test Configuration Files

**vitest.config.ts** - Primary test configuration
```typescript
- Environment: happy-dom (lightweight DOM)
- Globals: true (no imports needed)
- Setup file: src/test/setup.ts
- CSS support enabled
- PDF.js mocking configured
```

**vite.config.js** - Secondary test configuration (duplicate settings)

### Test Setup (src/test/setup.ts)

```typescript
- Mocks localStorage for all tests
- Mocks PDF.js library with empty page
- Imports @testing-library/jest-dom matchers
```

### Test Mocks (src/test/__mocks__/)
- **pdfjs-dist.mjs** - Mock PDF.js for unit tests

---

## 6. TEST FILES INVENTORY

### Total Test Coverage: 21 test files, ~4,077 lines

#### Unit Tests by Type:

**Component Tests** (10 files - 945 lines)
```
src/__tests__/
├── Button.test.jsx (24 lines)
│   └── Tests: Glassmorphism styling, variant props
├── Header.test.jsx (106 lines)
│   └── Tests: Gradient fallback, accessibility, SVG aria-hidden
├── UploadCard.test.jsx (152 lines)
│   └── Tests: File upload interactions
├── SectionTitle.test.jsx
│   └── Tests: Section rendering
├── MainContent.test.jsx (171 lines)
│   └── Tests: Main layout and routing
├── ResumeUpload.test.jsx (152 lines)
│   └── Tests: Resume upload workflow
├── mobile-layout.test.jsx (180 lines)
│   └── Tests: Responsive design
├── smoke.test.jsx (6 lines)
│   └── Tests: Basic test framework verification
├── JobMatch.test.jsx (51 lines)
│   └── Tests: Job match analysis display, localStorage
└── (more component tests)
```

**Service/API Tests** (6 files - 1,100+ lines)
```
src/services/
├── api.test.js (192 lines)
│   └── Tests: parseResume, analyzeResume, optimizeResume
├── exportPdf.test.js
│   └── Tests: PDF export functionality
└── (more service tests)
```

**Library Tests** (3 files - 800+ lines)
```
src/lib/
├── aiClient.test.ts
│   └── Tests: AI request error handling, payload normalization
├── assets.test.ts (257 lines)
│   └── Tests: Asset URL resolution, image CDN
└── (more lib tests)
```

**Hook Tests** (2 files)
```
src/hooks/
├── useAuth.test.jsx (50 lines)
│   └── Tests: Google OAuth redirect, session handling
└── (more hook tests)
```

**Integration Tests** (3 files - 500+ lines)
```
src/__tests__/
├── aiConfig.test.ts (45 lines)
│   └── Tests: OpenAI config resolution, token clamping
├── resumeText.test.js (190 lines)
│   └── Tests: PDF/DOCX/text parsing, MIME type inference
├── supabase.test.js (221 lines)
│   └── Tests: Supabase auth and storage
└── matchScore.fixture.test.js
    └── Tests: Match score calculations
└── shimmer-animations.test.ts (227 lines)
    └── Tests: Animation utilities
└── helloWorld.test.ts
    └── Tests: Basic sanity check
```

### Test Framework Stack
- **Framework**: Vitest 4.0.9
- **DOM Environment**: happy-dom 20.0.10 (lightweight alternative to jsdom)
- **React Testing**: @testing-library/react 16.3.0
- **User Interactions**: @testing-library/user-event 14.6.1
- **Assertions**: @testing-library/jest-dom 6.9.1

### Test Scripts (package.json)
```json
{
  "test": "vitest run",           // Run tests once
  "test:watch": "vitest"          // Watch mode
}
```

---

## 7. TESTING FRAMEWORKS & METHODOLOGY

### Framework Details

**Vitest** - Modern test runner
- ESM support out-of-the-box
- Vite configuration reuse
- Faster execution than Jest

**React Testing Library**
- User-centric testing approach
- Queries: getByRole, getByText, getByPlaceholderText
- No implementation detail testing
- Accessibility-first approach

**Testing Patterns Observed**

1. **Component Rendering Tests**
   - Verify DOM elements render correctly
   - Test conditional rendering
   - Accessibility checks (aria-hidden, roles)

2. **State & Interaction Tests**
   - User event simulation (act, fireEvent)
   - localStorage mocking
   - Hook state management

3. **Service/API Tests**
   - Mock fetch API
   - Error handling verification
   - Response transformation testing

4. **Mock Strategy**
   - vi.mock() for module mocking
   - vi.hoisted() for setup mocks
   - Global mocks in setup.ts

---

## 8. SOURCE CODE FILES SUMMARY

### Total Source Files: ~80 files (excluding tests)

| Category | Count | Lines | Purpose |
|----------|-------|-------|---------|
| Components | 40 | 15,000+ | UI and layout |
| Features | 7 | 9,000+ | Feature modules |
| Hooks | 3 | 300 | Custom React hooks |
| Services | 6 | 3,000+ | API & external services |
| Libraries | 8 | 2,000+ | Utilities and helpers |
| Backend Functions | 9 | 4,000+ | Netlify serverless |
| Config & Setup | 10 | 500 | Build and test config |

### Approximate Total: 15,000+ lines of application code

---

## 9. KEY FUNCTIONALITY AREAS

### Frontend Features

#### 1. **Resume Upload & Parsing**
   - Multi-format support (PDF, DOCX, TXT, images)
   - DeepSeek OCR for image-based resumes
   - Automatic section detection
   - Structured JSON extraction
   - Drag-and-drop interface

#### 2. **Job Matching Analysis**
   - TF-IDF similarity scoring (0-100)
   - Missing keyword identification
   - Matched keywords highlighting
   - Coverage and cosine similarity metrics
   - Fallback algorithm when AI unavailable

#### 3. **AI-Powered Optimization**
   - Section-by-section suggestions
   - Multiple optimization modes (conservative/aggressive)
   - Keyword recommendations
   - Examples before/after
   - Anti-hallucination safeguards

#### 4. **Resume Templates**
   - Multiple professional templates
   - Live preview gallery
   - ATS-friendly formatting
   - Export as PDF (styled/plain)

#### 5. **Authentication**
   - Supabase Google OAuth
   - Redirect URL handling
   - Session management
   - localhost/remote environment support

#### 6. **Advanced Features**
   - Bulk analysis (compare versions)
   - Cover letter generation
   - Interview prep questions
   - Keyword analysis tool
   - Dark mode support

#### 7. **UI/UX Components**
   - Animated cards and counters
   - Magnetic buttons with hover effects
   - Parallax sections
   - Shimmer animations
   - Toast notifications
   - Modal dialogs

### Backend Services

#### 1. **Resume Processing**
   - Text extraction from multiple formats
   - PDF.js for PDFs
   - ZIP/XML parsing for DOCX
   - OCR fallback for images
   - Normalization and cleaning

#### 2. **AI Integration**
   - OpenAI GPT-5 Nano API
   - Configurable temperature/tokens
   - Error handling and retries
   - Response streaming support
   - Cost optimization

#### 3. **Analysis Algorithms**
   - TF-IDF similarity scoring
   - Keyword frequency analysis
   - Stop-word filtering
   - Token overlap detection
   - Cosine similarity calculations

#### 4. **Batch Processing**
   - Concurrent task execution
   - Per-task error handling
   - Transaction-like semantics
   - Progress tracking

#### 5. **Rate Limiting**
   - Token bucket algorithm
   - Per-user request throttling
   - Abuse prevention
   - Configurable limits

---

## 10. DEVELOPMENT SCRIPTS

### NPM Scripts
```json
{
  "dev": "vite",                          // Dev server
  "dev:netlify": "npx netlify dev",      // Netlify dev with functions
  "build": "node scripts/build.mjs",     // Custom build
  "build:vite": "vite build",            // Vite build
  "preview": "vite preview",             // Preview production build
  "lint": "eslint .",                    // ESLint linting
  "test": "vitest run",                  // Run tests once
  "test:watch": "vitest"                 // Watch mode
}
```

### Local Testing Scripts
- `test-local.sh` - Local testing shell script
- `test-parse-resume.ps1` - PowerShell test script

---

## 11. DEPENDENCIES OVERVIEW

### Production Dependencies (7 major)
- **react** (19.2.0) - UI framework
- **react-dom** (19.2.0) - React rendering
- **react-router-dom** (7.9.6) - Routing
- **@supabase/supabase-js** (2.81.1) - Backend as a service
- **axios** (1.13.2) - HTTP client
- **pdfjs-dist** (5.4.394) - PDF processing
- **framer-motion** (12.23.24) - Animations
- **lucide-react** (0.553.0) - Icon library
- **@netlify/functions** (5.1.0) - Netlify serverless
- **@netlify/dev** (4.8.0) - Local development

### Dev Dependencies (Major Testing/Build Tools)
- **vitest** (4.0.9) - Test runner
- **@testing-library/react** (16.3.0) - React testing
- **@testing-library/jest-dom** (6.9.1) - DOM matchers
- **happy-dom** (20.0.10) - Lightweight DOM
- **jsdom** (27.2.0) - Full DOM implementation
- **vite** (7.2.2) - Build tool
- **@vitejs/plugin-react** (5.1.1) - React support
- **@tailwindcss/vite** (4.1.17) - Tailwind CSS
- **TypeScript** (5.9.3) - Type checking
- **ESLint** (9.39.1) - Code linting

---

## 12. BUILD & TEST PIPELINE

### Development Workflow
```
npm install
  ↓
npm run dev:netlify          (or npm run dev for frontend only)
  ↓
[Local dev with HMR]
  ↓
npm run test:watch           (Optional: run tests)
  ↓
npm run lint                 (Check code quality)
```

### Production Build
```
npm run build                → Vite bundles frontend + node scripts build
  ↓
Netlify deployment          → Functions deployed automatically
  ↓
Live at https://resume-optimizing.netlify.app
```

### Test Execution
```
npm run test                 → Vitest runs all tests once
  ↓
Reports pass/fail for each suite
```

---

## 13. TESTING COVERAGE HIGHLIGHTS

### What IS Tested

✅ **Component Rendering**
- Button styling (glassmorphism tokens)
- Header gradient fallbacks
- JobMatch analysis display
- Form inputs and validation

✅ **User Interactions**
- Google OAuth redirect flow
- localStorage persistence
- File upload handling
- Modal interactions

✅ **API/Services**
- Resume parsing (multiple formats)
- Job match scoring
- Resume optimization
- Batch processing

✅ **Utilities**
- MIME type inference
- Text extraction (PDF/DOCX)
- Keyword tokenization
- Asset URL resolution

✅ **Authentication**
- Supabase OAuth configuration
- Redirect URL handling
- Session management

### Notable Test Examples

**Button Component Test**
```javascript
// Verifies glassmorphism design tokens are applied
expect(button.className).toContain("bg-[image:var(--gradient-primary-value)]");
```

**JobMatch Test**
```javascript
// Tests rendering with Saudi-specific styling
expect(screen.getByRole('heading', { name: /match to a saudi job role/i })).toBeInTheDocument();
```

**Resume Text Test**
```javascript
// Complex DOCX archive parsing with ZIP and deflate
const arrayBuffer = buildDocxArchive(xml);
const text = await extractPlainTextFromArrayBuffer(arrayBuffer, {...});
expect(text).toContain("Senior Engineer");
```

---

## 14. ARCHITECTURE PATTERNS

### Frontend Architecture
- **Component-Based**: Atomic design with UI, Features, and Layout tiers
- **Hooks-Based State**: Custom hooks for auth, theme, analysis
- **Service Layer**: Centralized API calls in services/
- **Context API**: AuthProvider for global auth state
- **Vite + React Fast Refresh**: Hot module reloading

### Backend Architecture
- **Serverless Functions**: Netlify Functions (no containers)
- **TypeScript Everywhere**: Type safety across stack
- **Modular Libraries**: Shared logic in netlify/lib/
- **Environment Config**: ai-config.ts for OpenAI settings
- **Error Handling**: Consistent error responses

### Testing Architecture
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API and service testing
- **Happy-DOM**: Lightweight test environment
- **Mock Strategy**: Module mocking with vi.mock()
- **Accessibility Testing**: aria-hidden, roles verification

---

## 15. CONFIGURATION FILES

### TypeScript Configuration
- **tsconfig.json** - Strict mode enabled
- **Type Definitions**: vite-env.d.ts for Vite types

### Linting
- **eslint.config.js** - ESLint rules
- **Rules Include**: React hooks, React refresh

### Build Tools
- **Tailwind Configuration**: tailwind.config.ts (v4)
- **Vite Configuration**: vite.config.js with React + Tailwind plugins
- **Build Output**: Rollup options (external: path2d)

### Environment Variables
Key environment variables used:
```
OPENAI_API_KEY           - OpenAI API access
VITE_SUPABASE_URL        - Supabase endpoint
VITE_SUPABASE_ANON_KEY   - Supabase auth key
VITE_SUPABASE_REDIRECT_URL - OAuth redirect URL
VITE_USE_MOCK_AI         - Use mock AI (development)
OPENAI_MODEL             - Model override (gpt-5-nano default)
```

---

## 16. KEY INSIGHTS & OBSERVATIONS

### Strengths
1. **Well-Organized Structure**: Clear separation of concerns (components, hooks, services, features)
2. **Comprehensive Testing**: 21 test files covering components, services, and integrations
3. **Type Safety**: TypeScript used throughout backend and some frontend
4. **Error Handling**: Robust error messages and fallbacks in AI integrations
5. **Accessibility**: Tests verify ARIA attributes and semantic HTML
6. **Performance**: Lightweight DOM (happy-dom) for faster tests
7. **Backend Flexibility**: Serverless functions handle multiple resume formats

### Testing Coverage Areas
- Resume parsing (PDF, DOCX, TXT, images)
- Job matching algorithms (TF-IDF, fallbacks)
- OAuth authentication flow
- API error handling and retries
- Component rendering and interactions
- Accessibility compliance
- Animation utilities

### Growth Opportunities
- Backend function tests (currently untested)
- E2E tests with real API calls
- Performance benchmarks
- Load testing for batch operations
- Visual regression testing

---

## 17. PROJECT SIZE METRICS

| Metric | Count |
|--------|-------|
| Total Source Files | ~80 |
| Total Test Files | 21 |
| Test Lines of Code | 4,077 |
| Source Lines of Code | 15,000+ |
| Components | 40 |
| Features | 7 |
| Backend Functions | 9 |
| npm Dependencies | 10+ |
| npm Dev Dependencies | 15+ |
| Bundle Size (gzipped) | ~162 KB |

---

## 18. DEPLOYMENT & HOSTING

**Platform**: Netlify
- **Frontend**: Static site hosting with continuous deployment
- **Functions**: Serverless TypeScript functions (auto-deployed)
- **Environment**: Netlify environment variables management
- **Domain**: resume-optimizing.netlify.app

---

## SUMMARY

The resume-customizer is a well-architected full-stack application combining:
- **Frontend**: React 19 with modern component patterns
- **Backend**: 9 specialized Netlify serverless functions
- **Testing**: Comprehensive test suite with 21 files, 4,077 lines
- **AI Integration**: OpenAI GPT-5 Nano for intelligent resume optimization
- **Saudi Market Focus**: Specialized for Gulf region job seekers

The testing infrastructure is robust for UI and service layer, with good coverage of critical paths like resume parsing, authentication, and job matching algorithms.

