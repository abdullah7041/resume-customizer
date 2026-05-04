# AI Data Flow

This reference is a compact map for AI resume work. Read current source files before relying on it.

## Primary Boundaries

- Browser text extraction happens before most server parsing. `src/lib/utils/resumeText.ts` dynamically imports `pdfjs-dist`; `src/services/api.js` sends extracted text when possible.
- Netlify functions handle AI-facing endpoints in `netlify/functions/`, including parsing, matching, optimization, cover letters, question prediction, and streaming optimization.
- Shared backend validation lives in `netlify/lib/resume-schemas.ts`; frontend validation and store rules live under `src/lib/validation/` and `src/lib/stores/`.
- OpenRouter access is centralized in `netlify/lib/openrouter-client.js` and streaming support in `netlify/lib/openrouter-stream.js`.
- Resume normalization and vulnerability analysis live in `netlify/lib/normalize-resume.js` and `netlify/lib/vulnerability-detector.ts`.

## Invariants

- Use `OPENROUTER_API_KEY` for AI functions.
- Use the existing lite/flash model tier pattern rather than adding new model routing casually.
- Keep score prompts evidence-based and anti-inflationary.
- Rewritten bullets must preserve truth and include STAR plus metric structure when that endpoint requires it.
- Treat AI output as suggestions unless the user applies it through the established flow.
- Keep frontend PDF/DOCX extraction in the browser path unless there is a clear architecture reason to change it.

## Verification Focus

- Parsing tests for text/file fallbacks.
- Match and optimization tests for genuine score calculation.
- Schema tests for request/response compatibility.
- UI/store tests for suggestion display and applied-state behavior.
