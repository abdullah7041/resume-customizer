# Engineering Notes (read on demand)

> Not auto-loaded. Read this file BEFORE touching the area it covers. The trigger
> map in `CLAUDE.md` tells you which section applies. Every rule here is load-bearing —
> most encode a production incident. Do not "simplify" a gotcha away.

## Critical Gotchas

- **Supabase server-side**: Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (anon key → RLS 42501 errors)
- **Supabase PromiseLike**: Query builder returns PromiseLike (only `.then()`), NOT full Promise — wrap fire-and-forget with `Promise.resolve()` before `.catch()`
- **DB migrations**: Output SQL for user to run in Supabase dashboard. NEVER apply directly.
- **Netlify functions**: 30s timeout default, 1024MB memory for `generate-pdf` (Puppeteer). No localhost URLs.
- **Vite chunking**: `@react-pdf` MUST stay in one chunk (`vendor-pdf`) — circular deps break if split. Same for `@sentry` (`vendor-sentry`). `react-i18next` MUST be in `vendor-react` chunk.
- **OpenRouter**: All AI functions use `OPENROUTER_API_KEY` env var. Two tiers: `lite` (gemini-2.5-flash-lite) for parsing, `flash` (gemini-2.5-flash) for all analysis — with per-function `reasoningBudget` caps to control latency. NOTE: `flash` is NOT viable for `parse_resume` — it exceeds the 30s function limit and its default reasoning burns the output budget (truncation). Parsing stays on `lite`.
- **Resume parse latency/output budget**: `parse_resume` (`netlify/lib/ai-contracts/contracts/index.js`) uses `maxTokens: 8192`, `timeoutMs: 20000`, and `reasoningBudget: 0` (thinking DISABLED). A 4096 cap truncated legitimate rich-CV JSON, while 16384 let pathological whitespace output consume Netlify's 30s limit. CRITICAL: leave reasoning OFF — with gemini-2.5-flash-lite's default thinking ON, reasoning tokens consumed the 8192 output budget (truncation on rich CVs) and pushed latency to ~26s; OFF, the real JSON (~2-3k tokens) fits with headroom at ~6s. Do NOT raise maxTokens to "fix" a truncation — that re-opens the 30s timeout path; disable reasoning instead. The `reasoningBudget` knob: `0`=disable (`reasoning:{enabled:false}` OpenRouter / `thinkingBudget:0` Gemini), `>0`=cap, `null`=model default. Token usage is logged BEFORE the truncation throw in `openrouter-client.js` so a truncation shows its reasoning-vs-completion split. There is NO second AI attempt on truncation: re-parsing the full resume on direct Gemini stacked two multi-second generations and overran the 30s limit (→ hard 500). OpenRouter truncation now throws fast (`openrouter-client.js` only falls back to Gemini on genuine 5xx/auth/network/timeout outages, never on truncation). There is also NO focused AI re-parse: dropped sections (incl. dropped work entries) are recovered deterministically from raw text by `parse-quality.js` (`recoverSectionsFromRawText`/`buildDeterministicBaseline`). Once readable text exists, an AI parser/provider failure NEVER 500s — `extract-resume-json.ts` builds the deterministic skeleton and returns 200 with `meta.parseQuality.aiParseFailed/aiFailureCode/confidence:"low"` and `extractionSource` ending `+deterministic`.
- **Scanned/image-only PDFs**: when text extraction yields no selectable text, signed-in PDF uploads fall back to OCR via `netlify/lib/ocr-extract.js` (Gemini native, OpenRouter `file-parser` engine), recorded as `meta.parseQuality.ocrFallback/pagesProcessed`. Guests keep the `resume/unreadable-file` rejection.
- **Resume parse section contract**: `resumeJsonSchema` explicitly defines item fields for `education/skills/projects/certificates/languages` and requires every top-level section container. Keep the item fields optional (empty arrays represent absent evidence), but do not remove the top-level `required` list: with strict structured output, optional section containers let `lite` stop after `basics`+`work` and omit evidenced sections entirely.
- **AI Scoring Prompts**: Anti-inflation rules enforced in BOTH `processMatchOnly` and `optimizeResume`. 80+ = hireable today, 60-79 = competitive with gaps, <60 = significant gaps. NEVER score >90 without full evidence. Do NOT re-add "score 85+ for excellent match" anchors.
- **Bullet Improvements**: STAR + Metric enforcement is MANDATORY. Every `improved` bullet must have [Action Verb] + [Task] + [Quantified Result]. Inferred metrics appended with `(verify)`. Missing JD keywords must be woven INTO rewritten bullets (not just listed separately).
- **Client-Side PDF Parsing**: PDF/DOCX text extraction happens in the **browser** via `pdfjs-dist` (dynamically imported in `src/lib/utils/resumeText.ts`). The `parseResume` API function in `src/services/api.js` extracts text client-side and sends `kind: "text"` to the server. Falls back to `kind: "file"` (base64) only if client extraction yields <100 chars (scanned PDFs). This saves 5-8s of serverless execution time.
- **Vulnerability → Optimization**: The optimize endpoint accepts optional `workHistory` (structured work entries) and runs `detectVulnerabilities()` to find career red flags (gaps, short tenures, pivots, demotions, job hopping). These are injected into the AI prompt so bullet rewrites proactively neutralize interview concerns. The `WorkHistoryEntrySchema` MUST be declared BEFORE `OptimizeRequestSchema` in `resume-schemas.ts` (TDZ).
- **Cover Letter Tone**: The `generateCoverLetter` function accepts a `tone` parameter (`professional|enthusiastic|formal|creative`). The frontend tone selector UI already exists in `CoverLetterSection.tsx`. The tone flows: Frontend → `generate-cover-letter.ts` → `gemini-client.js` prompt injection.
- **SSE Streaming (optimize-stream)**: `optimize-stream.ts` uses **Netlify Functions v2** syntax (`export default async function(request: Request): Promise<Response>`) and returns a `ReadableStream` with SSE events. It streams progress phases: `validating → detecting_vulnerabilities → ai_processing → building_response → result → done`. The frontend (`optimizeResumeStream` in `api.js`) consumes these via `ReadableStream.getReader()` and falls back to the legacy `optimize.ts` (v1 syntax) on failure. Both endpoints share the same card-building logic. The v2 function uses `export const config = { path: '/api/optimize-stream' }` for custom routing.

## Debugging

Diagnose root cause BEFORE writing fix code. Trace the full data flow: frontend → API → backend → database → response → frontend display. State your diagnosis first. For score bugs, trace from AI generation to display — scores must be genuine calculations, never placeholders.

## Key File Locations

- **State store**: `src/lib/stores/resumeStore.ts` (Zustand, localStorage persistence, fuzzy merge logic)
- **Types**: `src/types/templates.ts`, `src/types/analysis.ts`, `src/types/resume.d.ts`
- **Validation**: `src/lib/validation/store-schemas.ts` (Zod), `netlify/lib/resume-schemas.ts`
- **AI client**: `netlify/lib/openrouter-client.js` — `callOpenRouter('lite'|'flash', messages, schema?, options?)`
- **Templates**: `src/components/templates/` — registry pattern, 4 templates, PDF via `@react-pdf/renderer`
- **Netlify functions**: `netlify/functions/` — parse-resume, extract-resume-json, ai-match, optimize, predict-questions, generate-cover-letter, generate-pdf, batch-api, user-data-api, referral-api

## Deeper references (read only when the task needs them)

- Architecture & data flow: `@docs/ARCHITECTURE.md`  ← literal folder name is `@docs` (not a Claude import)
- Conventions & patterns: `@docs/CONVENTIONS.md`
