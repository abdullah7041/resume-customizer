# AI Resume Optimizer - Copilot Instructions

## Architecture Overview

This is a **Netlify-deployed React SPA** with serverless functions that optimizes resumes against job descriptions using OpenAI. The app has three core flows: **Resume Upload → Job Match → AI Optimization**.

### Critical Structure
- **Frontend**: React 19 + Vite + Tailwind v4, deployed to Netlify CDN
- **Backend**: Netlify Functions (TypeScript) in `netlify/functions/`
- **Storage**: Supabase for auth, resume storage (`resumes/` bucket), and user data
- **AI**: OpenAI chat completions API via proxy functions (avoid CORS, hide keys)

### Data Flow
1. User uploads PDF/DOCX or pastes text → `parse-resume.ts` extracts plainText
2. Resume + job description → `match-score.ts` calculates TF-IDF similarity (0-100 score)
3. User triggers optimization → `ai.ts` proxy calls OpenAI with structured prompts
4. Results stored in `localStorage` (client-side persistence) with keys prefixed `airo:`

## Critical Files & Patterns

### Netlify Functions (`netlify/functions/`)
- **`ai.ts`**: OpenAI proxy - sends `messages` to `https://api.openai.com/v1/chat/completions`
  - Normalizes `max_output_tokens` vs deprecated `max_completion_tokens`
  - Returns `{ output_text, model, usage }` to client
  - **IMPORTANT**: Always use `messages` (not `input`) in request body
- **`match-score.ts`**: TF-IDF similarity + keyword extraction (no AI, pure text analysis)
- **`parse-resume.ts`**: Extracts plainText from PDF/DOCX using `pdfjs-dist` + custom DOCX parser
- **`optimize.ts`**: Legacy endpoint (prefer `ai.ts` for new features)

**AI Config**: `netlify/lib/ai-config.ts` centralizes defaults (`gpt-5-nano`, **temp=0.7**, max tokens 1-4096)
  - **Temperature lowered to 0.7** for more factual, consistent outputs (reduced hallucination)

### Frontend Services (`src/services/`)
- **`api.js`**: Main API client - exports `parseResume()`, `analyzeResume()`, `optimizeResume()`
  - Handles timeouts (15s parse, 45s optimization)
  - Implements fallback scoring when backend returns all zeros
  - **Pattern**: Always sanitize text with `sanitize()` before API calls
  - **AI Prompts**: Include strict rules to prevent hallucination (no invented facts)
- **`supabase.js`**: Auth + storage - `uploadResumeFile()` saves to `resumes/` bucket with user ID prefix
- **`exportPdf.js`**: Generates styled/ATS-plain PDFs (uses window.print or Supabase export)

### State Management (`src/components/MainContent.jsx`)
- **Single source of truth** for resume data, match analysis, optimizations
- **localStorage keys**: `airo:resumeData`, `airo:jobDescription`, `airo:lastActiveTab`, `airo:previewQuotaUsed`
- **Enhanced Validation**: Multi-layer binary/base64 data detection prevents corrupted plainText display
  ```javascript
  const isBinary = /^[\x00-\x1F\x7F-\xFF]{20,}/.test(plainText);
  const isBase64Like = /^[A-Za-z0-9+/=]{100,}$/.test(plainText.replace(/\s/g, ""));
  const hasControlChars = (plainText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g) || []).length > plainText.length * 0.1;
  const hasWeirdEncoding = /[�]{3,}/.test(plainText);
  ```

### Resume Parsing (`shared/normalize-resume.js`)
- **Section detection**: Regex matches common headers (summary, skills, experience, etc.)
- **Bullet preservation**: Keeps `•●◦‣▪·-` markers + content structure
- Returns `{ sections[], bullets[], plainText }` - used by AI prompts

### Design System (`src/styles/theme.css` + Tailwind)
- **Theme tokens**: `--surface-glass`, `--glass-border`, `--shadow-card` for glassmorphism
- **Color palette**: Emerald (`#0ea472`), royal teal (`#075951`), Saudi gold (`#f4d37d`)
- **Components**: All in `src/components/ui/` - `Button`, `Card`, `Input`, `Tabs`, `Toast`
- **Pattern**: Use `cn()` utility (`src/lib/cn.js`) for conditional classes
- **Match Score Emojis**: 🎯 Strong (75+), ⚡ Moderate (50-74), 🔧 Needs work (<50)

## Development Workflows

### Local Development
```bash
npm install
netlify dev  # Runs Vite + functions at http://localhost:8888
```
- Vite dev server: `localhost:5173` (auto-proxied by Netlify CLI)
- Functions: `/.netlify/functions/*` routes to local TypeScript handlers
- **Mock AI**: Set `VITE_USE_MOCK_AI=true` to skip OpenAI calls in dev

### Testing
```bash
npm run test          # Vitest with happy-dom
npm run lint          # ESLint v9 flat config
```
- **Test setup**: `src/test/setup.ts` mocks `pdfjs-dist` (see `src/test/__mocks__/`)
- **Pattern**: Mock Supabase client in tests - check `src/__tests__/supabase.test.js`

### Build & Deploy
```bash
npm run build  # Executes scripts/build.mjs → sets VITE_BUILD_ID → vite build
```
- **Build ID**: `Date.now()` timestamp for cache busting (appended to asset URLs via `src/lib/assets.ts`)
- **Netlify auto-deploys** on push to `main` (see `netlify.toml`)

## Common Debugging Scenarios

### 504 Gateway Timeout Errors
- **Cause**: Incorrect OpenAI endpoint or missing `OPENAI_API_KEY`
- **Fix**: Verify `ai.ts` uses `/v1/chat/completions` (NOT `/v1/responses`)

### Binary Data Display in Resume Section
- **Cause**: Base64/ArrayBuffer stored in localStorage instead of plainText
- **Fix**: Enhanced validation in `MainContent.jsx` and `ResumeUpload.jsx` now detects and clears corrupted data
- **Manual Fix**: Run `localStorage.clear()` in browser console

### Match Score Always 0
- **Cause**: Backend returns 0 for all metrics despite overlap
- **Fix**: `api.js` has fallback scoring - ensure `buildFallbackMatch()` is called
- **Minimum scores**: 15 for any overlap, 20-50 based on keyword hit ratio

### AI Hallucination (Invented Facts)
- **Cause**: High temperature or weak prompt constraints
- **Fix**: Temperature reduced to 0.7, strict prompt rules added in `buildPrompt()`
- **Key Rule**: "ONLY use information explicitly stated in the resume - DO NOT invent facts"

### PDF Parsing Fails
- **Cause**: Scanned image PDF or corrupt file
- **Fix**: `parse-resume.ts` tries `pdfjs-dist` first, then fallback regex extraction

## Project-Specific Conventions

1. **Function naming**: Netlify functions use kebab-case (`match-score.ts`), frontend uses camelCase
2. **Error handling**: Use `AppError` class (`src/services/supabase.js`) for structured errors
3. **Toast notifications**: Always provide `{ type, title, description }` - see `MainContent.jsx` toast patterns
4. **API timeouts**: Parse=15s, Optimization=45s - extend in `api.js` constants if needed
5. **localStorage prefix**: All keys start with `airo:` for namespacing
6. **Resume storage path**: Supabase format is `resumes/{userId}/{timestamp}_{filename}`
7. **AI Temperature**: Always use 0.7 for factual responses (prevent hallucination)
8. **Match score display**: Include emojis (🎯⚡🔧) for visual quality indicators

## Environment Variables

**Required in Netlify:**
- `OPENAI_API_KEY` - OpenAI API key (serverless functions only)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon public key
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side file operations (optional)

**Optional:**
- `VITE_BUILD_ID` - Cache buster (auto-generated in prod)
- `VITE_USE_MOCK_AI` - Skip real AI calls in development
- `OPENAI_MODEL` - Override default model (defaults to `gpt-5-nano`)

## Key Integration Points

### Supabase Auth Flow
- Sign in via Google OAuth → `useAuth.jsx` hook manages session
- Auth state stored in Supabase (cookies) + React context
- Premium tier checks: `user?.user_metadata?.is_premium` or `user?.app_metadata?.plan === "premium"`

### OpenAI Request Format
```typescript
// Correct format for ai.ts
{
  model: "gpt-5-nano",
  temperature: 0.7,  // Lowered from 1.0
  max_output_tokens: 2048,
  messages: [
    { role: "system", content: "You are a resume optimizer..." },
    { role: "user", content: "RESUME:\n...\n\nJOB:\n..." }
  ]
}
```
- **Response**: `data.choices[0].message.content` contains output text
- **Never** use `input` parameter or content arrays - OpenAI chat API uses string messages

### AI Prompt Best Practices
```javascript
// Always include these constraints to prevent hallucination:
const prompt = `
CRITICAL RULES:
1. ONLY use information explicitly stated in the resume
2. DO NOT invent degrees, certifications, or experiences
3. DO NOT fabricate company names, dates, or achievements
4. ONLY suggest rewording existing content
5. Return valid JSON only
...
`;
```

## When Making Changes

1. **Netlify Functions**: Edit TypeScript in `netlify/functions/`, test with `netlify dev`
2. **API Contracts**: Update both `api.js` and function handler if changing request/response shape
3. **State Management**: Add new localStorage keys with `airo:` prefix, validate on load
4. **UI Components**: Extend `src/components/ui/` primitives, maintain `cn()` pattern
5. **Tests**: Run `npm test` before pushing - mock external deps (Supabase, pdfjs)
6. **AI Changes**: Always test with real resume data to check for hallucination
7. **Temperature**: Keep at 0.7 unless specific feature needs more creativity

## Recent Updates

- ✅ Temperature reduced from 1.0 to 0.7 for better factual accuracy
- ✅ Enhanced binary data validation (4-layer detection)
- ✅ Removed duplicate "Save to Account" button in Optimization
- ✅ Added emoji indicators for match score quality (🎯⚡🔧)
- ✅ Strengthened AI prompts with anti-hallucination rules
- ✅ Improved README with professional formatting and badges

## References
- Tailwind v4 docs: https://tailwindcss.com/docs/v4-beta
- OpenAI Chat API: https://platform.openai.com/docs/api-reference/chat
- Netlify Functions: https://docs.netlify.com/functions/overview/
- Supabase Storage: https://supabase.com/docs/guides/storage
