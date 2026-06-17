---
name: Debug-Resume-Parsing
description: Use when resume upload/parsing fails or returns bad output — empty/garbled text, "Could not extract readable text", resume/unreadable-file 422, missing sections (no work/education/skills), [object Object] plainText, scanned/image PDF, CID-font garbage, Arabic/RTL mojibake, DOCX not parsing, Gemini placeholder responses, or partial/incomplete parse. Diagnoses root cause across the client→server→AI pipeline and gives actionable fixes.
---

# Debug Resume Parsing

**Purpose**: Systematic diagnosis of resume parsing failures across the full pipeline (browser extraction → API → server re-validation → AI parse → quality gate). Find the root cause, fix at root, and verify the resume parses **fully** (no silently dropped sections).

## When to Use

- Upload fails with "Could not extract readable text…" / `resume/unreadable-file` (422)
- Parsed text is empty, too short (<100 chars), or binary garbage
- Garbled glyphs / mojibake — CID-font PDFs, Arabic/RTL reversed or broken
- Scanned / image-only PDF (no selectable text)
- DOCX uploads not parsing or returning empty
- Missing or partial sections (no work, education, skills) despite being in the file
- `plainText` is `[object Object]` or suspiciously ~15 chars
- AI returns placeholder ("please provide the resume", "I cannot…")
- Parse succeeds but `meta.parseQuality.incompleteSections` is set
- Timeouts (504), config errors (500), auth (401), rate limit (429), too large (413)

## Key Insight

Parsing has **two extraction passes** (browser + server) on the same code, then an **AI structuring pass**, then a **quality gate**. A failure means one specific stage produced bad output. **Identify the stage first — never guess.** Text extraction (PDF/DOCX/TXT) is deterministic and debuggable locally; the AI parse and the quality gate are separate concerns. "Unreadable file" is almost always extraction; "missing sections" is almost always the AI parse + quality gate.

## Protocol (MANDATORY)

### Step 1: Reproduce + Classify the Failure

Get the actual artifact and symptom. **If the user has not provided the resume file or the exact error, ask before guessing** (use `AskUserQuestion`):
- The file itself (or a redacted sample) — extraction bugs are file-specific
- File type: PDF (text-based? scanned?) / DOCX / TXT
- Exact error string or HTTP status, and the `code` field (e.g. `resume/unreadable-file`)
- Language (English / Arabic / mixed) — RTL has its own failure class
- Does it fail in the browser console or only server-side? Guest preview or signed-in?

Then classify with `classifyExtraction()` mentally: `empty` | `too-short` | `cid-glyph` | `readable`.

### Step 2: Trace the Pipeline (find the failing stage)

```
┌────────────────────────────┐
│ 1. Browser extraction       │  src/lib/utils/resumeText.ts
│    PDF: pdfjs → fallback     │  extractPlainTextFromArrayBuffer()
│    DOCX: zip+inflate→XML     │  → normalizeResumeText()
│    TXT: decodeUtf8           │  Symptom here: empty / garbled / <100
└─────────────┬──────────────┘
              │
┌─────────────▼──────────────┐
│ 2. Client decision          │  src/services/api.js parseResume()
│    readable & ≥100 →text     │  isReadableText() word-token check
│    else → base64 file        │  fires onOcrFallback() UI hint
└─────────────┬──────────────┘  Circuit breaker: 'openrouter-ai'
              │
┌─────────────▼──────────────┐
│ 3. Server re-validate        │  netlify/functions/extract-resume-json.ts
│    file: re-extract+readable │  same resumeText.js, MIN=100
│    text: defense readability │  → 422 resume/unreadable-file on fail
└─────────────┬──────────────┘  caps: 8MB file / 50k chars
              │
┌─────────────▼──────────────┐
│ 4. AI structuring            │  gemini-client.js parseResumeOnly()
│    OpenRouter 'lite' tier    │  → basics/work/education/skills/…
│    placeholder detection     │  PLACEHOLDER_PATTERNS → 422
└─────────────┬──────────────┘
              │
┌─────────────▼──────────────┐
│ 5. Parse-quality gate        │  netlify/lib/parse-quality.js
│    detectSectionSignals      │  signals in raw text vs AI output
│    findMissingSections       │  → focused retry (parseResumeOnly)
│    mergeWithEvidence         │  → recoverSectionsFromRawText
│    → meta.parseQuality        │  records incompleteSections (NOT error)
└────────────────────────────┘
```

**Log at each stage** (shape only — never log resume text content):
- Stage 1: extracted `.length`, `classifyExtraction()` result
- Stage 2: `kind` sent (`text` vs `file`), `isReadableText` verdict
- Stage 3: server pre-extract length, which 422 branch (if any)
- Stage 4: `typeof analysis.plainText`, placeholder hit?, textSource chosen
- Stage 5: `signals`, `incompleteSections`, `fallbackSections`, `retried`

### Step 3: Match Symptom → Root Cause → Fix

| Symptom | Root cause | Fix location / action |
|---------|-----------|----------------------|
| `empty` text, scanned look | Image-only PDF, no text layer | OCR not supported. Tell user to upload text-based file or paste text. Confirm `kind:"file"` fallback + `onOcrFallback()` UI hint fired. |
| `cid-glyph` garbage (ö ü ã ÿ runs) | CID font w/o ToUnicode CMap; pdfjs returns glyph indices | `isReadableText` word-token check should reject → file fallback → server 422. If garbage slips to AI, the check failed: verify `classifyExtraction`/`isReadableText` in BOTH `resumeText.ts` and `extract-resume-json.ts` agree. cMap URLs in `extractPdfPlainText` must resolve (unpkg `pdfjs-dist@5.4.394/cmaps/`). |
| `too-short` (<100) | Sparse PDF, partial extract, or pdfjs failed silently | Check pdfjs path threw → `extractPdfTextFallback` ran. Verify worker disabled (`disableWorker:true`, `workerSrc=""`). |
| DOCX empty | `findDocumentXml` couldn't locate/inflate `word/document.xml` | Check zip central-dir parse, compression method (0/8 only), inflate (`inflateRawSync`/`DecompressionStream`), size caps (2MB compressed / 5MB inflated). |
| Arabic reversed/broken | RTL reading-order / bidi | pdfjs pre-applies bidi per item; `collectPdfPageText` sorts by X. Don't double-reverse. Verify against [[arabic-rtl-string-rendering]] — terminal may show reversed but data correct. Consider `parse-arabic-resume.ts`. |
| `[object Object]` / ~15-char plainText | AI returned object where string expected | `safeStringify()` in extract-resume-json handles this — verify it's applied; check `analysis.plainText` vs `meta.raw_text` source. |
| Gemini placeholder ("please provide…") | AI got no/invalid content | `PLACEHOLDER_PATTERNS` → 422. Means upstream extraction sent empty/garbage. Fix Stage 1-3, not the prompt. |
| Missing sections, parse OK | AI parser dropped a section present in text | Quality gate handles: focused retry → `recoverSectionsFromRawText`. If still missing, check `detectSectionSignals` regex vs the actual heading wording. Surfaced as `meta.parseQuality.incompleteSections` (partial, not failure). |
| 422 only when signed-in path differs | Guest cap vs full path divergence | Guest: 2MB / 20k chars; full: 8MB / 50k. Check which branch. |
| 500 "AI service not configured" | `OPENROUTER_API_KEY` missing | Set Netlify env var. See [[debug-netlify-502]]. |
| 504 / "timed out" | OpenRouter slow | Retryable; client retries 3×/2s. Check `reasoningBudget` cap for lite tier. |
| "high load, wait 30s" | Circuit breaker open | `circuit-breaker.ts` `openrouter-ai` tripped by repeated failures — fix the underlying failures, don't bypass. |
| 401 auth required | No/expired Supabase token | Sign in. Server validates `supabase.auth.getUser(token)`. |

### Step 4: State Diagnosis BEFORE Fixing

Per CLAUDE.md debugging rule: **diagnose root cause first**. Write: "Failure is at Stage N because [evidence]. Root cause: [X]. Minimal fix: [Y]." Get confirmation if the fix touches shared extraction logic (it affects both client and server passes).

### Step 5: Fix + Ensure FULL Parse (best practices)

Don't stop at "no error." A parse that drops a section is still a failure.

1. **Fix at root**, in shared `resumeText.ts` when extraction-related (server `resumeText.js` mirrors it — keep both in sync, including `isReadableText` thresholds).
2. **Verify completeness**: after fix, `meta.parseQuality.incompleteSections` MUST be empty for a well-formed resume. If non-empty, extend `detectSectionSignals` heading patterns or `recoverSectionsFromRawText`.
3. **No fabrication**: recovery uses ONLY visible raw text. Never invent content to fill a section.
4. **Preserve readability gate**: never weaken `isReadableText` to "pass" garbage — that pushes CID junk to the AI and burns credits.
5. **Test with the real file** ([[test-until-real-flow-works]]): runtime-critical parsing must be tested with an actual PDF/DOCX in a real dev run, not unit mocks alone.

### Step 6: Verify

```bash
npm run quality:parallel
```

- Run the real upload flow (`npm run dev:netlify`) with the failing file → succeeds
- All expected sections present; `meta.parseQuality.incompleteSections` empty
- No `[object Object]`, no placeholder text, full `plainText` length
- Arabic/RTL renders correctly in the app (not just terminal)

## Anti-Patterns (DO NOT DO THIS)

- ❌ Loosening `isReadableText` / `MIN_READABLE_TEXT_LENGTH` to force a pass — sends garbage to AI
- ❌ Editing the Gemini prompt to fix an *extraction* problem (placeholder = no input, not bad prompt)
- ❌ Fixing only the client pass and leaving server `resumeText.js` divergent (or vice versa)
- ❌ Treating `meta.parseQuality.incompleteSections` as cosmetic — it means data was lost
- ❌ Fabricating section content to silence a missing-section warning
- ❌ Adding OCR claims — scanned/image PDFs are explicitly unsupported; guide the user instead
- ❌ Bumping timeouts to mask a circuit-breaker / crash root cause (see [[debug-netlify-502]])

## Files to Check (Common Locations)

**Shared extraction (fixes propagate to both passes — KEEP IN SYNC):**
- `src/lib/utils/resumeText.ts` — client: pdfjs, DOCX zip/inflate, normalize, `classifyExtraction`, `isReadableText`
- `netlify/lib/resumeText.js` — server mirror of the above

**Client orchestration:**
- `src/services/api.js` — `parseResume()`: kind decision, base64 fallback, retry, circuit breaker
- `src/lib/utils/circuit-breaker.ts` — `openrouter-ai` breaker

**Server:**
- `netlify/functions/extract-resume-json.ts` — auth, re-validate, 422 branches, best-text selection, placeholder detection
- `netlify/functions/parse-resume.ts`, `netlify/functions/parse-arabic-resume.ts`
- `netlify/lib/gemini-client.js` — `parseResumeOnly()`, focused retry, `PLACEHOLDER_PATTERNS`
- `netlify/lib/parse-quality.js` — `detectSectionSignals`, `findMissingSections`, `mergeWithEvidence`, `recoverSectionsFromRawText`

## Success Criteria

- ✅ Failing stage identified with evidence (not guessed)
- ✅ Root cause stated before any fix
- ✅ Fix applied at root; client + server extraction kept in sync
- ✅ Real failing file now parses FULLY — all sections present, `incompleteSections` empty
- ✅ No garbage/placeholder/`[object Object]`; readability gate intact
- ✅ Tested with the real file in a dev run, not just mocks
- ✅ `npm run quality:parallel` passes
