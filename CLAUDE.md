# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Guidelines

- Use **context7 MCP** in every implementation task to find better solutions for bugs
- Double-check code before writing
- Update `CLAUDE.md` when project conventions change
- Recommend Claude model based on task difficulty:
  - **Haiku**: Simple tasks (quick edits, explanations)
  - **Sonnet**: Medium complexity (feature implementation, debugging)
  - **Opus**: Complex tasks (architecture, multi-file refactors)
- Ask clarifying questions for better understanding
- Keep answers clear & concise
- Choose only popular & proven tech stacks
- Write in plain, easy-to-understand English
- Prefer fewer lines of code

## Agent Skills (MANDATORY)

- **best-practices**: (`.agent/skills/best-practices/SKILL.md`) - **CRITICAL:** ALWAYS read this file before ANY implementation or debugging task. It contains the mandatory research protocol for latest standards.
- **vibe-coding**: (`.agent/skills/vibe-coding/SKILL.md`) - Use for high-velocity, intent-driven development and agentic orchestration.
- **Rules**: Prefer fewer lines of code in all implementations.

## MANDATORY: Post-Task Quality Protocol

> [!IMPORTANT]
> **THIS IS NON-NEGOTIABLE:** After completing ANY code modification, you MUST run quality checks and fix all errors before marking the task complete.

### Automated Quality Checks

**1. Post-Task Hook (Automatic)**
- `.claude/settings.json` is configured to automatically run `npm run quality:check` after every task
- This check runs ESLint, TypeScript compiler, and unit tests
- Task is NOT complete until this passes with zero errors

**2. Pre-Commit Hook (Automatic)**
- Husky + lint-staged runs on every Git commit
- Automatically fixes fixable linting issues
- Blocks commits if TypeScript errors exist

### Manual Quality Commands

```bash
# Run full quality check (lint + types + tests)
npm run quality:check

# Auto-fix linting issues + check types + run tests
npm run quality:fix

# Individual checks
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run type:check    # Check TypeScript
npm run test          # Run unit tests
npm run test:watch    # Run tests in watch mode
```

## Development Commands

```bash
# Local development
npm run dev                    # Start Vite dev server (port 5173)
npm run dev:netlify            # Start Netlify dev server (port 8888, includes functions)

# Building
npm run build                  # Production build (runs custom build script)
npm run build:vite             # Direct Vite build
npm run build:analyze          # Build with bundle analyzer
npm run preview                # Preview production build

# Quality checks
npm run quality:check          # Run all quality checks
npm run quality:fix            # Auto-fix and check
npm run lint                   # ESLint check
npm run lint:fix               # ESLint auto-fix
npm run type:check             # TypeScript compilation check
npm run test                   # Run unit tests
npm run test:watch             # Run tests in watch mode
```

## High-Level Architecture

### Application Structure

**Frontend Entry**: `src/App.tsx`
- Wraps with DirectionProvider (i18n), AuthGate (Supabase auth)
- Renders Header, FeaturesShowcase, MainContent, ConsentBanner
- Dark theme UI with gradient background

**Main Layout**: `src/components/Layout/MainContent.tsx`
- Tab-based workflow: Resume Upload → Match Analysis → Optimization → Templates → Interview Prep
- Manages component-level state using React hooks
- Persists state to localStorage for session recovery
- Integrates with Zustand store for optimized resume merging

### State Management (Zustand)

**Store**: `src/lib/stores/resumeStore.ts`
- Centralized state management with localStorage persistence
- **Key responsibilities**:
  - Manages originalResume vs optimizedResume toggle (`showOptimized` flag)
  - Merges optimizations using **content-based fuzzy text matching**
  - Caches AI match analysis (5-minute TTL) using fingerprint-based keys
  - Tracks optimization results with section IDs and applied states
  - Stores optimization metrics (scores, gaps, keyword strategies)

**Critical Store Methods**:
- `setOriginalResume()` - Validates and deduplicates resume data
- `getActiveResume()` - Merges applied optimizations with original using fuzzy text matching
- `addOptimization()` / `applyOptimization()` - Granular control over optimization application
- `setCachedAnalysis()` / `getCachedAnalysis()` - Prevents redundant API calls

**Validation**: Uses Zod schemas from `src/lib/validation/store-schemas.ts` to catch data mismatches early

### Type System Organization

**Central Type Definitions**:
- `src/types/templates.ts` - Resume state, optimization results, template configurations
- `src/types/analysis.ts` - Match analysis response, gap analysis, keyword strategy
- `src/types/resume.d.ts` - JSON Resume schema (extends jsonresume.org standard)
- `src/lib/validation/store-schemas.ts` - Zod schemas mirroring resume structure

**Important Pattern**: All AI-modified data tracked in `meta.ai_suggestions` to preserve schema integrity

### Template System

**Architecture**: `src/components/templates/`
- **Registry Pattern**: `registry.ts` maps template IDs to React components
- **Four Templates**:
  1. Modern Professional - Clean, minimal design (emerald theme)
  2. Classic Traditional - Serif-based, two-column layout (gray theme)
  3. Technical Engineer - Skills-first for tech roles (blue theme)
  4. ATS Optimized - Single-column for applicant tracking systems (emerald theme)

**PDF Generation**:
- `src/components/templates/pdf/` - React-PDF components for each template
- `pdf/shared.ts` - Common styling, formatters, and layout helpers
- Uses `@react-pdf/renderer` for client-side PDF rendering

**Template Props**:
```typescript
interface TemplateProps {
  resume: ResumeSchema;
  isAtsMode?: boolean;
  scale?: number;
}
```

### Netlify Functions Architecture

**Functions** (`netlify/functions/`):

| Function | Purpose | Model Used |
|----------|---------|------------|
| `parse-resume.ts` | Extract text from PDF/DOCX | N/A (OCR) |
| `extract-resume-json.ts` | Convert text to JSON Resume schema | gemini-2.5-flash-lite (fast) |
| `ai-match.ts` | TF-IDF + cosine similarity matching | gemini-2.5-flash |
| `optimize.ts` | AI-driven optimization suggestions | gemini-2.5-flash (slowest) |
| `predict-questions.ts` | Interview question generation | gemini-2.5-flash |
| `generate-cover-letter.ts` | Cover letter generation | gemini-2.5-flash |
| `generate-pdf.ts` | Server-side PDF generation | N/A (Puppeteer) |
| `batch-api.ts` | Bulk resume analysis | gemini-2.5-flash |
| `delete-user-data.ts` | GDPR compliance | N/A |
| `export-user-data.ts` | GDPR compliance | N/A |

**Dual Model Strategy**:
- `gemini-2.5-flash-lite` - Fast, low-cost for parsing (completions in seconds)
- `gemini-2.5-flash` - Higher quality for AI analysis (completions in 10-30 seconds)

**Request Validation**: All endpoints use Zod schemas from `netlify/lib/resume-schemas.ts`

**Rate Limiting** (`netlify/lib/rate-limiter.ts`):
- Upstash Redis-backed sliding window (20 requests/min per IP)
- Stricter limits for expensive endpoints:
  - `optimize`: 5 req/min (flash model, heavy prompt)
  - `ai-match`: 10 req/min (flash model)
  - `parse-resume`: 10 req/min (OCR involved)
- Exponential backoff with jitter for retries
- Falls back to allowing requests if rate limiter unavailable

### Optimization Flow (Critical Data Path)

```
1. Upload Resume → parseResume() → JSON Resume schema → Zustand Store
2. Paste Job Description → analyzeResumeWithAI() → Match Score → Cached (5-min TTL)
3. Click "Optimize" → optimizeResume() → OptimizationCards[] → User reviews
4. Apply Cards → getActiveResume() → Fuzzy merge → Zustand tracks applied state
5. Export Resume → getActiveResume() → Merge optimizations → Template render → PDF
```

**Optimization Merging Logic** (`resumeStore.ts` lines 217-474):
- Content-based matching finds where to apply changes
- Fuzzy text matching handles truncation and slight variations
- **Skills are suggested but NOT auto-injected** (ethical choice - user must add manually)
- Tracks which optimizations were successfully applied

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| State Management | Zustand | Simpler than Redux, perfect for this scale |
| Matching Algorithm | TF-IDF + Cosine Similarity | Fast, free (no API costs), deterministic |
| PDF Export | @react-pdf/renderer | Client-side rendering, no server dependencies |
| Authentication | Supabase Auth | Already integrated, reduces vendor complexity |
| AI Model | Gemini 2.5 Flash | Cost-effective, deterministic output (temperature=0) |
| Validation | Zod | Runtime type safety at boundaries |
| Styling | Tailwind CSS v4 | Utility-first, dark mode support |
| Testing | Vitest | Fast, ESM-native, Vite integration |

## TypeScript Standards

- **Never use `any`** - always define proper interfaces in `src/types/`
- **All function parameters** must have explicit types
- **All API responses** must have typed interfaces
- **All component props** must be typed with interfaces
- **React hooks** must have properly typed return values

**Note**: `tsconfig.json` has `"strict": false` for legacy compatibility, but new code should follow strict typing

## Important Conventions

1. **Logging Prefixes**: All store/function changes logged with `[ResumeStore]` or `[optimize]` prefixes
2. **Error Objects**: Include `status`, `code`, `message` for structured error handling
3. **Resume Text**: Can be either plain text or parsed JSON Resume
4. **Optimizations**: Only applied if `applied: true` flag is set
5. **Skills**: Never auto-injected (recommendations only, user must add manually)
6. **Cache Keys**: Generated from first 100 chars + length of both resume and job description
7. **File Paths**: Use `@/` alias for imports from `src/` directory

## Build Configuration

### Vite Build (`vite.config.js`)

**Critical Chunking Rules**:
- `@react-pdf` packages MUST stay in one chunk (`vendor-pdf`) - circular dependencies cause initialization errors if split
- `@sentry` packages MUST stay in one chunk (`vendor-sentry`) - same reason
- `react-i18next` MUST be bundled in `vendor-react` chunk to fix initialization errors

**Manual Chunks**:
- `vendor-react` - React core (loads immediately)
- `vendor-state` - Zustand
- `vendor-pdf` - @react-pdf/renderer + dependencies
- `vendor-supabase` - Supabase (lazy loaded)
- `vendor-icons` - lucide-react (tree-shaken)
- `vendor-docs` - docx (lazy loaded)
- `vendor-pdfjs` - pdfjs-dist (parsing)
- `vendor-sentry` - Sentry error tracking
- `vendor-i18n` - i18next + react-i18next

**Optimizations**:
- Target: ES2020
- Minifier: esbuild (faster than terser)
- Source maps: disabled in production
- CSS code splitting: enabled
- Bundle size warning: 600KB threshold

### Netlify Configuration (`netlify.toml`)

**Functions Settings**:
- Node bundler: esbuild
- Timeout: 30 seconds for most functions
- Memory: 1024MB for `generate-pdf` (Puppeteer)
- External modules: `@supabase/supabase-js`, `pdfjs-dist`, `axios`, `@netlify/functions`, `@sparticuz/chromium`
- Included files: `netlify/lib/**` (shared modules)

**Environment Variables**:
- Client-side vars prefixed with `VITE_` (safe to expose)
- Server-side vars in Netlify dashboard (never committed)

## Quality Checklist (Must Pass)

Before completing ANY code task, ensure:
- [ ] `npm run lint` passes with 0 warnings
- [ ] `npm run type:check` passes with 0 errors
- [ ] `npm run test` passes with 0 failures
- [ ] All new interfaces added to `src/types/`
- [ ] No `any` types used anywhere
- [ ] All imports are actually used
- [ ] React components have unique keys in `.map()`

## Enforcement Rules

1. **Never ask the user** if you should fix quality issues - FIX THEM IMMEDIATELY
2. **Do not mark tasks complete** while `quality:check` has errors
3. **Common fixes to apply automatically:**
   - Missing types → Add explicit TypeScript interfaces
   - Unused imports → Remove them
   - Missing React keys → Add unique keys to mapped elements
   - `any` type warnings → Replace with proper typed interfaces
   - ESLint rule violations → Follow the suggested fix

## Auto-Fix Workflow

```bash
# 1. Auto-fix what can be fixed
npm run lint:fix

# 2. Check what remains
npm run quality:check

# 3. Manually fix TypeScript errors
# (ESLint errors should be gone after step 1)

# 4. Verify everything passes
npm run quality:check
```

## Deployment Architecture

- **Frontend**: Vite SPA deployed to Netlify (dist/ folder)
- **Backend**: Netlify Functions (serverless)
- **External Services**:
  - Gemini API (AI processing)
  - Supabase (Auth + Storage)
  - Upstash Redis (Rate limiting)
  - Sentry (Error tracking)

---

**Remember:** Quality checks are automated and enforced. There is no "skipping" this step.
