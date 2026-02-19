# Architecture Reference

> This file is loaded on demand via `@docs/ARCHITECTURE.md` — not every session.

## Application Structure

**Frontend Entry**: `src/App.tsx`
- Wraps with DirectionProvider (i18n), AuthGate (Supabase auth)
- Renders Header, FeaturesShowcase, MainContent, ConsentBanner
- Dark theme UI with gradient background

**Main Layout**: `src/components/Layout/MainContent.tsx`
- Tab-based workflow: Resume Upload → Match Analysis → Optimization → Templates → Interview Prep
- Manages component-level state using React hooks
- Persists state to localStorage for session recovery
- Integrates with Zustand store for optimized resume merging

## State Management (Zustand)

**Store**: `src/lib/stores/resumeStore.ts`
- Manages originalResume vs optimizedResume toggle (`showOptimized` flag)
- Merges optimizations using content-based fuzzy text matching
- Caches AI match analysis (5-minute TTL) using fingerprint-based keys
- Tracks optimization results with section IDs and applied states

**Critical Methods**:
- `setOriginalResume()` — Validates and deduplicates resume data
- `getActiveResume()` — Merges applied optimizations with original using fuzzy text matching
- `addOptimization()` / `applyOptimization()` — Granular control over optimization application
- `setCachedAnalysis()` / `getCachedAnalysis()` — Prevents redundant API calls

**Validation**: Zod schemas from `src/lib/validation/store-schemas.ts`

## Optimization Flow (Critical Data Path)

```
1. Upload Resume → parseResume() → JSON Resume schema → Zustand Store
2. Paste Job Description → analyzeResumeWithAI() → Match Score → Cached (5-min TTL)
3. Click "Optimize" → optimizeResume() → OptimizationCards[] → User reviews
4. Apply Cards → getActiveResume() → Fuzzy merge → Zustand tracks applied state
5. Export Resume → getActiveResume() → Merge optimizations → Template render → PDF
```

**Merging Logic** (`resumeStore.ts` lines 217-474):
- Content-based matching finds where to apply changes
- Fuzzy text matching handles truncation and slight variations
- Skills are suggested but NOT auto-injected (ethical choice)
- Tracks which optimizations were successfully applied

## Template System

**Location**: `src/components/templates/`
- **Registry Pattern**: `registry.ts` maps template IDs to React components
- **Templates**: Modern Professional (emerald), Classic Traditional (gray), Technical Engineer (blue), ATS Optimized (emerald)
- **i18n**: Templates detect resume content language — section headers render in resume's language, NOT UI language. RTL auto-applied for Arabic.
- **PDF**: `src/components/templates/pdf/` — React-PDF components per template, `pdf/shared.ts` for common styles

```typescript
interface TemplateProps {
  resume: ResumeSchema;
  isAtsMode?: boolean;
  scale?: number;
}
```

## Netlify Functions

| Function | Purpose | Model |
|----------|---------|-------|
| `parse-resume.ts` | Extract text from PDF/DOCX | N/A (OCR) |
| `extract-resume-json.ts` | Text → JSON Resume schema | lite (gemini-2.5-flash-lite) |
| `ai-match.ts` | TF-IDF + cosine similarity | flash (gemini-2.5-flash) |
| `optimize.ts` | AI optimization suggestions | flash |
| `predict-questions.ts` | Interview question generation | flash |
| `generate-cover-letter.ts` | Cover letter generation | flash |
| `parse-arabic-resume.ts` | Arabic/bilingual parsing | lite |
| `generate-pdf.ts` | Server-side PDF (Puppeteer) | N/A |
| `batch-api.ts` | Bulk resume analysis | flash |
| `user-data-api.ts` | GDPR compliance (unified) | N/A |
| `referral-api.ts` | Referral system (unified) | N/A |

**Shared Libraries** (`netlify/lib/`):
- `openrouter-client.js` — Unified AI API client
- `supabase-client.ts` — Singleton with fallback env vars
- `credit-manager.js` — Credit consumption/tracking
- `rate-limiter.ts` — Upstash Redis sliding window (20 req/min per IP; optimize: 5/min, ai-match: 10/min, parse-resume: 10/min)
- `email-service.js` / `email-templates.js` — Resend integration
- `referral-manager.js` — Referral tracking/rewards
- `ip-utils.js` — IP validation for abuse prevention
- `sentry.js` — Error tracking

## OpenRouter Client API

```javascript
callOpenRouter(
  modelType: 'lite' | 'flash',
  messages: Array<{role, content}>,
  jsonSchema: Object | null,
  options: { temperature?: number, maxTokens?: number, schemaName?: string }
): Promise<string>
```

Usage:
```javascript
import { callOpenRouter } from '../lib/openrouter-client.js';
// Parsing (fast)
await callOpenRouter('lite', messages, null, { temperature: 0, maxTokens: 4096 });
// Structured output
await callOpenRouter('flash', messages, schema, { temperature: 0, maxTokens: 16384, schemaName: 'optimization_response' });
```

## Build Configuration

**Vite** (`vite.config.js`): Target ES2020, esbuild minifier, CSS code splitting enabled, 600KB bundle warning.

**Manual Chunks**: vendor-react, vendor-state, vendor-pdf, vendor-supabase (lazy), vendor-icons (tree-shaken), vendor-docs (lazy), vendor-pdfjs, vendor-sentry, vendor-i18n.

**Netlify** (`netlify.toml`): esbuild bundler, 30s timeout, 1024MB for generate-pdf. External modules: @supabase/supabase-js, pdfjs-dist, axios, @netlify/functions, @sparticuz/chromium.

## Deployment

- **Frontend**: Vite SPA → Netlify (dist/)
- **Backend**: Netlify Functions (serverless)
- **Services**: OpenRouter (Gemini AI), Supabase (Auth + DB), Upstash Redis (rate limiting), Sentry (errors)

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| State | Zustand | Simpler than Redux, right scale |
| Matching | TF-IDF + Cosine Similarity | Fast, free, deterministic |
| PDF | @react-pdf/renderer | Client-side, no server deps |
| Auth | Supabase Auth | Already integrated |
| AI | OpenRouter (Gemini 2.5) | Unified tracking, cost-effective |
| Validation | Zod | Runtime type safety at boundaries |
| Styling | Tailwind CSS v4 | Utility-first, dark mode |
| Testing | Vitest | Fast, ESM-native, Vite integration |