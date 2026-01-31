# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Brand Identity

**Watheq** (واثق) - Saudi-themed AI Resume Optimizer
- Primary Color: Saudi Green (`#006C35`)
- Accent Color: Warm Gold
- Storage Key Prefix: `watheq:` (migrated from legacy `airo:`)

## 🤖 AUTOMATIC PROTOCOLS (Claude Must Follow Every Session)

> [!CRITICAL]
> **These protocols are MANDATORY and AUTOMATIC. Claude must apply them in EVERY session without the user needing to ask.**

### 1. Pre-Task Research Protocol (ALWAYS)
**Before writing ANY code:**
1. Use `context7 mcp` → `resolve-library-id` → `query-docs` for library research
2. Search for 2026 best practices if uncertain
3. Read `.agent/skills/best-practices/SKILL.md` for current standards

**Example**: Before implementing auth, research latest Supabase patterns via context7.

### 2. MCP Context Awareness (AUTOMATIC)
- **Check token usage**: Run `/context` before complex tasks
- **Current setup**: Supabase (3.2k) + Context7 (0.9k) = ~4k tokens
- **Alert user if**: MCP tools exceed 10k tokens (needs optimization)
- **Never suggest**: Enabling Notion, Canva, or Sentry unless explicitly needed

### 3. Task Decomposition (AUTO-TRIGGER)
**Automatically use for:**
- Tasks affecting 3+ files
- Multi-domain work (frontend + backend + tests)
- Complex refactoring or new features

**Pattern**:
1. Break into 2-3 parallel subtasks
2. Launch Explore agents simultaneously
3. Consolidate in Plan Mode
4. Execute with quality checks

**Reference**: See [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md)

### 4. Plan Mode for Complex Tasks (AUTOMATIC)
**Enter Plan Mode when:**
- 3+ files will be modified
- Architecture decisions needed
- User requests complex feature
- Uncertainty about approach

**In Plan Mode**: Use Tasks (not Todos) for persistence across sessions

### 5. Quality Checks (NON-NEGOTIABLE)
**After EVERY code modification:**
```bash
npm run quality:parallel  # Runs automatically via post-task hook
```
- Must pass: ESLint (0 warnings), TypeScript (0 errors), Tests (0 failures)
- Auto-fix immediately if failures occur
- Never ask permission to fix quality issues

### 6. Model Selection (AUTOMATIC)
**Claude automatically recommends:**
- **Haiku**: Simple edits, explanations, file reading
- **Sonnet**: Feature implementation, debugging, refactoring
- **Opus**: Architecture planning, complex multi-file refactors

**Cost awareness**: Mention when Opus might be expensive for user's budget

### 7. Tasks vs Todos (AUTOMATIC)
**Use Tasks for:**
- Multi-session projects
- Features with dependencies
- Complex implementations (auth, payments, etc.)

**Use Todos for:**
- Single-session work
- Simple fixes
- No dependencies

**Tasks syntax**: `#1, #2, #3` with `blocked by` relationships

---

## Development Guidelines

- Double-check code before writing
- Update `CLAUDE.md` when project conventions change
- Ask clarifying questions for better understanding
- Keep answers clear & concise
- Choose only popular & proven tech stacks
- Write in plain, easy-to-understand English
- Prefer fewer lines of code

## Agent Skills (AUTO-LOADED)

- **best-practices**: (`.agent/skills/best-practices/SKILL.md`) - Contains MCP optimization, task decomposition, research protocol
- **vibe-coding**: (`.agent/skills/vibe-coding/SKILL.md`) - High-velocity development patterns
- **mcp-toolbox**: (`.agent/skills/mcp-toolbox/SKILL.md`) - MCP server reference

**Additional Resources**:
- [CLAUDE_CODE_BEST_PRACTICES.md](CLAUDE_CODE_BEST_PRACTICES.md) - Complete 2026 best practices
- [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md) - Parallel agent workflows
- [AI_ALTERNATIVES.md](AI_ALTERNATIVES.md) - Cline, Continue.dev, Aider
- [API_COST_ANALYSIS.md](API_COST_ANALYSIS.md) - Budget optimization
- [TASKS_FEATURE_GUIDE.md](TASKS_FEATURE_GUIDE.md) - New Tasks feature

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
# RECOMMENDED: Parallel quality check (2-3x faster)
npm run quality:parallel   # Runs lint, type:check, test simultaneously

# Sequential quality check (slower, but easier to read output)
npm run quality:check      # Runs lint → type:check → test

# Auto-fix linting issues + check types + run tests
npm run quality:fix

# Individual checks
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run type:check    # Check TypeScript
npm run test          # Run unit tests
npm run test:watch    # Run tests in watch mode
```

**Automatic Enforcement**: Post-task hook runs `quality:check` after every code modification.

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
npm run quality:parallel       # Run all checks in parallel (RECOMMENDED, 2-3x faster)
npm run quality:check          # Run all quality checks sequentially
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

**i18n Support**:
- Templates detect resume content language (English vs Arabic)
- Section headers render in the resume's language, NOT the UI language
- RTL layout applied automatically for Arabic resumes

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
| `extract-resume-json.ts` | Convert text to JSON Resume schema | OpenRouter: google/gemini-2.5-flash-lite |
| `ai-match.ts` | TF-IDF + cosine similarity matching | OpenRouter: google/gemini-2.5-flash |
| `optimize.ts` | AI-driven optimization suggestions | OpenRouter: google/gemini-2.5-flash |
| `predict-questions.ts` | Interview question generation | OpenRouter: google/gemini-2.5-flash |
| `generate-cover-letter.ts` | Cover letter generation | OpenRouter: google/gemini-2.5-flash |
| `parse-arabic-resume.ts` | Parse Arabic/bilingual resumes | OpenRouter: google/gemini-2.5-flash-lite |
| `generate-pdf.ts` | Server-side PDF generation | N/A (Puppeteer) |
| `batch-api.ts` | Bulk resume analysis | OpenRouter: google/gemini-2.5-flash |
| `user-data-api.ts` | GDPR compliance (unified endpoint) | N/A |
| `referral-api.ts` | Referral system (unified endpoint) | N/A |
| `waitlist-confirm.ts` | Waitlist email confirmation | N/A |
| `notify-waitlist.ts` | Waitlist notification automation | N/A |
| `dev-reset-credits.ts` | Development credit reset tool | N/A |

**AI Provider Architecture**:
- **Provider**: OpenRouter API (`openrouter-client.js`)
- **Dual Model Strategy**:
  - `lite` tier → `google/gemini-2.5-flash-lite` - Fast, low-cost for parsing (completions in seconds)
  - `flash` tier → `google/gemini-2.5-flash` - Higher quality for AI analysis (completions in 10-30 seconds)
- **Benefits**: Unified quota tracking, automatic failover, cost optimization through OpenRouter

**Request Validation**: All endpoints use Zod schemas from `netlify/lib/resume-schemas.ts`

**Shared Libraries** (`netlify/lib/`):
- `supabase-client.ts` - Singleton Supabase client with fallback env vars
- `openrouter-client.js` - Unified AI API client (replaces direct Google AI SDK)
- `credit-manager.js` - Credit consumption and tracking
- `email-service.js` - Email delivery via Resend
- `email-templates.js` - Email template generation
- `referral-manager.js` - Referral tracking and rewards
- `rate-limiter.ts` - Upstash Redis-backed rate limiting
- `ip-utils.js` - IP validation for abuse prevention
- `sentry.js` - Error tracking integration

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
| AI Provider | OpenRouter (Gemini 2.5) | Unified quota tracking, cost-effective, structured output |
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

1. **Logging Prefixes**: All store/function changes logged with component/function prefixes:
   - `[ResumeStore]` - Zustand store operations
   - `[OpenRouter]` - AI API calls via OpenRouter client
   - `[extract-resume-json]` - Resume parsing function
   - `[optimize]` - Optimization function
2. **Error Objects**: Include `status`, `code`, `message` for structured error handling
3. **Resume Text**: Can be either plain text or parsed JSON Resume
4. **Optimizations**: Only applied if `applied: true` flag is set
5. **Skills**: Never auto-injected (recommendations only, user must add manually)
6. **Cache Keys**: Generated from first 100 chars + length of both resume and job description
7. **File Paths**: Use `@/` alias for imports from `src/` directory
8. **Storage Keys**: Use `watheq:` prefix for all localStorage keys (e.g., `watheq:resumeData`, `watheq:lastJobDescription`)
9. **Environment Variables**:
   - `OPENROUTER_API_KEY` - Required for all AI functions (replaces legacy `GEMINI_API_KEY`)
   - All AI functions validate this key before processing

## AI Client Architecture

### OpenRouter Client (`netlify/lib/openrouter-client.js`)

**Purpose**: Unified API client for all AI operations, replacing direct Google AI SDK usage.

**Key Features**:
- **Model Abstraction**: Internal tier names (`lite`, `flash`) map to OpenRouter model IDs
- **Structured Output**: Automatic conversion from Google AI schema format to OpenRouter JSON schema
- **Error Handling**: Comprehensive error messages with status codes
- **Type Safety**: Returns typed responses for predictable parsing

**Function Signature**:
```javascript
callOpenRouter(
  modelType: 'lite' | 'flash',     // Model tier to use
  messages: Array<{role, content}>, // Chat messages
  jsonSchema: Object | null,        // Optional JSON schema for structured output
  options: {                        // Optional configuration
    temperature?: number,           // Default: 0
    maxTokens?: number,             // Default: 16384
    schemaName?: string             // Schema name for strict mode
  }
): Promise<string>                  // Returns JSON string if schema provided
```

**Usage Pattern**:
```javascript
import { callOpenRouter } from '../lib/openrouter-client.js';

// For parsing (fast, lite model)
const messages = [{ role: 'user', content: prompt }];
const response = await callOpenRouter('lite', messages, null, {
  temperature: 0,
  maxTokens: 4096
});

// For structured output (with schema validation)
const response = await callOpenRouter('flash', messages, schema, {
  temperature: 0,
  maxTokens: 16384,
  schemaName: 'optimization_response'
});
```

**Migration Notes**:
- All functions previously using `@google/generative-ai` now use `openrouter-client.js`
- `gemini-client.js` is a compatibility wrapper that internally calls OpenRouter
- Environment variable: `OPENROUTER_API_KEY` (replaces `GEMINI_API_KEY`)

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

## Enforcement Rules (AUTOMATIC - No User Prompting Needed)

### Quality & Code Standards
1. **Never ask the user** if you should fix quality issues - FIX THEM IMMEDIATELY
2. **Do not mark tasks complete** while `quality:check` has errors
3. **Always use `quality:parallel`** for faster checks (2-3x speedup)
4. **Common fixes to apply automatically:**
   - Missing types → Add explicit TypeScript interfaces
   - Unused imports → Remove them
   - Missing React keys → Add unique keys to mapped elements
   - `any` type warnings → Replace with proper typed interfaces
   - ESLint rule violations → Follow the suggested fix

### Research & Best Practices
5. **Before ANY implementation**: Use `context7 mcp` to research library docs
6. **For complex tasks (3+ files)**: Automatically enter Plan Mode
7. **Multi-domain tasks**: Use task decomposition pattern without asking
8. **Uncertainty about approach**: Use Plan Mode and create Tasks (not Todos)

### MCP & Context Management
9. **Monitor token usage**: Check `/context` before complex tasks
10. **Alert user if MCP > 10k tokens**: Suggest optimization
11. **Never suggest**: Enabling Notion/Canva/Sentry unless explicitly needed for feature
12. **Current optimized setup**: Only Supabase + Context7 enabled (~4k tokens)

### Model Selection
13. **Automatically recommend**:
    - Haiku for: Simple edits, explanations, file reading
    - Sonnet for: Feature implementation, debugging, refactoring
    - Opus for: Architecture, complex multi-file refactors
14. **Warn user**: When Opus might exceed their budget

### Tasks vs Todos
15. **Use Tasks for**: Multi-session projects, complex features with dependencies
16. **Use Todos for**: Simple single-session work
17. **Tasks syntax**: Use `#1, #2, #3` numbering with `blocked by` relationships

### Never Do This (Anti-Patterns)
- ❌ Skip research for unfamiliar libraries
- ❌ Enable all MCP servers "just in case"
- ❌ Use Opus for simple bug fixes
- ❌ Ask permission to fix linting/TypeScript errors
- ❌ Mark task complete with failing quality checks
- ❌ Use Todos for complex multi-session projects (use Tasks)

## Auto-Fix Workflow (AUTOMATIC)

```bash
# 1. Auto-fix what can be fixed
npm run lint:fix

# 2. Check what remains (use parallel for speed)
npm run quality:parallel

# 3. Manually fix TypeScript errors
# (ESLint errors should be gone after step 1)

# 4. Verify everything passes
npm run quality:parallel  # 2-3x faster than quality:check
```

**Claude executes this automatically** - user doesn't need to ask.

## Deployment Architecture

- **Frontend**: Vite SPA deployed to Netlify (dist/ folder)
- **Backend**: Netlify Functions (serverless)
- **External Services**:
  - Gemini API (AI processing)
  - Supabase (Auth + Storage)
  - Upstash Redis (Rate limiting)
  - Sentry (Error tracking)

## Recent Enhancements (Implemented)

The following features were recently implemented:

### UI/UX Improvements
- **Page Break Indicators**: Toggleable page break markers in TemplatesSection (`PageBreakIndicator.tsx`)
- **Language Selector**: Auto-detects English vs Arabic content with badge (`useResumeLanguage.ts`)
- **Cache Key Performance**: FNV-1a hash with memoization (~2x faster than previous djb2)

### Backend Infrastructure (Latest)
- **Unified API Endpoints**: Consolidated GDPR (`user-data-api.ts`) and referral (`referral-api.ts`) functions
- **Feedback System Upgrade**: Milestone-based prompts (3rd, 15th, 40th use) with rich analytics context
- **Waitlist Feature**: Email confirmation workflow with Resend integration
- **Abuse Prevention**: IP tracking and validation (`ip-utils.js`)
- **Credits Context**: Global credit state management via React Context (`CreditsContext.tsx`)
- **Shared Supabase Client**: Singleton pattern with fallback environment variables (`supabase-client.ts`)

### Test Infrastructure
- **Fixed 46 Test Failures**: Improved mocking for Supabase, Auth, and browser environments
- **Environment Configuration**: Proper test env vars in `vitest.config.ts`
- **100% Test Pass Rate**: All 298 tests passing with 0 failures

---

## 🔄 Session Initialization Checklist (Claude's Internal Protocol)

**At the start of EVERY session, Claude automatically:**

1. ✅ Loads `.agent/skills/best-practices/SKILL.md` for current standards
2. ✅ Remembers MCP optimization (Supabase + Context7 only, ~4k tokens)
3. ✅ Knows to use `context7 mcp` before implementation
4. ✅ Uses Plan Mode for complex tasks (3+ files)
5. ✅ Applies task decomposition for multi-domain work
6. ✅ Runs `quality:parallel` after code changes
7. ✅ Creates Tasks (not Todos) for multi-session projects
8. ✅ Recommends appropriate model (Haiku/Sonnet/Opus)
9. ✅ Fixes quality issues immediately without asking

**User never needs to:**
- ❌ Remind Claude to research libraries (automatic via context7)
- ❌ Ask to use Plan Mode (triggers automatically for complex tasks)
- ❌ Request quality checks (runs automatically via post-task hook)
- ❌ Specify model selection (Claude recommends based on complexity)
- ❌ Explain MCP optimization (already configured in settings)
- ❌ Ask for task decomposition (applies automatically when beneficial)

**Reference Documentation (Loaded Automatically):**
- [CLAUDE_CODE_BEST_PRACTICES.md](CLAUDE_CODE_BEST_PRACTICES.md) - Complete 2026 guidelines
- [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md) - Parallel agent workflows
- [TASKS_FEATURE_GUIDE.md](TASKS_FEATURE_GUIDE.md) - Tasks vs Todos usage
- [API_COST_ANALYSIS.md](API_COST_ANALYSIS.md) - Budget awareness
- [AI_ALTERNATIVES.md](AI_ALTERNATIVES.md) - Alternative tools reference

---

**Remember:** All protocols above are AUTOMATIC and MANDATORY. Quality checks are enforced. There is no "skipping" these steps.
