# Watheq Engineering Plan

## Current Project Snapshot

- React 19 + Vite SPA with internal tab navigation, not route-library navigation.
- Zustand and localStorage persist resume state, parsed text, optimization state, cached analysis, and user workflow progress.
- Netlify Functions provide the backend boundary for AI, PDF generation, credits, referrals, user data, feedback, waitlist, and scheduled jobs.
- Supabase handles browser auth through the public client and server-side privileged work through the service-role boundary.
- OpenRouter/Gemini power the AI resume pipeline for parsing, matching/scoring, optimization, clarifications, cover letters, interviews, and Vision 2030 analysis.
- Upstash Redis is used as an optimization cache through `netlify/lib/redis-cache.ts`.
- Sentry/logging now has shared backend redaction through `netlify/lib/sentry.ts`; remaining privacy review should focus on persistence, exported payloads, and any newly added logs.
- Arabic/RTL and mobile/export concerns remain open around template direction, PDF/DOCX output, mobile scan/upload behavior, fixed A4 scaling, and fragmented export paths.

## Current Decisions

- Custom Watheq skills are local repo skills under `.agents/skills/`, not imported from OpenAI/community repos.
- `AGENTS.md` is the always-on source of repo behavior.
- `AGENTS.md` now contains durable Tooling Rules for RTK, Context7 MCP, and OpenAI Docs MCP, plus a reusable tooling checklist.
- `docs/WATHEQ_ENGINEERING_PLAN.md` is the continuation/handoff file for future Codex sessions.
- `docs/WATHEQ_CREATIVE_IDEAS.md` is parking lot only; do not implement creative features before P0 risks are addressed.
- No third-party skill packs.
- Use relative repo paths only.

## Current Session Summary

- P0-1 Supabase server-client hardening status: implemented in the current dirty tree. `netlify/lib/supabase-client.ts` now requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for privileged server work, with focused tests present under `netlify/lib/__tests__/supabase-client.test.ts`.
- `scoreFromCategoryScores()` blocker status: fixed in `netlify/lib/score-utils.ts`. Empty, partial, missing-score, malformed, or non-finite category scores now return `null` instead of becoming a synthetic baseline. Focused score and optimize caller tests passed.
- `optimize-stream` endpoint-specific rate-limit blocker status: fixed in `netlify/lib/rate-limiter.ts`. Upstash rate limiters are now cached per endpoint config, and `optimize-stream` enforces 10 requests per 60 seconds. A new focused test file proves request 11 is rejected.
- Referral idempotency status: fixed in `netlify/lib/referral-manager.js`. `trackReferral()` now rewards only after a conditional `user_credits` relationship update returns the referee row, so repeat calls and missing referee rows do not award duplicate credits.
- Netlify TypeScript coverage status: fixed in `package.json` and `netlify/tsconfig.json`. `npm run type:check` now runs both the root app typecheck and `tsc -p netlify/tsconfig.json --noEmit`.
- AI match zero-score inflation status: fixed in `netlify/lib/gemini-client.js`. `processMatchOnly()` now preserves valid `score: 0` instead of replacing it with `50`; endpoint-level normalization keeps `0` through the `ai-match` response.
- Low-text/OCR service regression status: covered in `src/services/api.test.js`. Low-text PDF extraction now has a service-level regression proving the client sends `kind: "file"`, includes auth headers, calls the fallback callback, and surfaces a 422 without OCR-support claims.
- Signed-out Optimize export fallback status: fixed in `src/components/Layout/MainContent.tsx`. Supabase-first Optimize export now warns signed-out users but falls through to the existing browser print / Save as PDF fallback instead of returning early.
- Mixed Arabic/English direction status: fixed in `src/lib/utils/resumeDirection.ts` and covered across preview/export tests. `mixed` content now resolves to RTL, Optimize print HTML renders `dir="rtl"`, and Templates PDF/DOCX export paths receive RTL direction.
- Referral email logging/notification status: fixed in `netlify/lib/email-service.js`, `netlify/lib/referral-manager.js`, and `netlify/functions/referral-api.ts`. Referral email logs no longer include raw names/referee names/referrer names, referral notifications no longer derive display names from email local-parts, and referral idempotency behavior remains covered.
- OAuth trust/branding documentation status: documented the dashboard-driven Google sign-in trust checklist in `DEPLOYMENT_CHECKLIST.md`, including Supabase Auth Site URL/redirect/provider settings, Google Cloud OAuth branding/origin/redirect settings, `VITE_SUPABASE_URL`, `VITE_SUPABASE_REDIRECT_URL`, custom-domain rollout warnings, and browser smoke-test steps.
- P0 privacy/security hardening status: current pass tightened shared redaction helpers, replaced whole-error logging across AI/functions/cache/export/client surfaces, made `generate-pdf` require auth before parsing/rendering resume HTML, shortened clarification cache TTL to 10 minutes, and kept OAuth/privacy/terms pages untouched during Google review.
- Full Arabic workspace localization plus privacy/security hardening verification status: passed on 2026-05-19. `npm run build` completed successfully, and `npm run quality:parallel` completed with lint, root TypeScript, Netlify TypeScript, and the full Vitest suite passing.
- Browser persistence key hygiene status: fixed in `src/lib/utils/storage-migration.ts` and the affected UI persistence call sites. Current code now writes `watheq:*` keys for cover letters, last job description, bulk analysis, and workflow panel state, while old `airo:*` and `workflow-panel-*` keys remain readable and are copied forward without deleting saved user data.
- Tests/checks that passed this session:
  - `rtk tsc`
  - `rtk lint` with 0 errors and 3 warnings in `src/components/Layout/MainContent.tsx`
  - `rtk git diff --check`
  - `npm run test -- netlify/lib/__tests__/score-utils.test.ts`
  - `npm run test -- netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts`
  - `npm run test -- netlify/functions/__tests__/optimize-stream.test.ts`
  - `npm run test -- netlify/lib/__tests__/rate-limiter.test.ts`
  - `npm run test -- netlify/lib/__tests__/referral-manager.test.js`
  - `npm run test -- netlify/functions/__tests__/referral-api.test.ts`
  - Latest `npm run quality:parallel` passed with 62 test files, 555 passed tests, 2 skipped tests, and 0 lint/type errors
  - `npx tsc -p netlify/tsconfig.json --noEmit`
  - `npm run type:check`
  - `npm run test -- netlify/functions/__tests__/admin-gates.test.ts netlify/lib/__tests__/admin-gates.test.ts netlify/functions/__tests__/optimize-stream.test.ts netlify/lib/__tests__/rate-limiter.test.ts`
  - `npm run quality:parallel` with 0 errors and the same 3 existing `MainContent.tsx` lint warnings
  - `npm run test -- netlify/lib/__tests__/gemini-client.test.js`
  - `npm run test -- netlify/functions/__tests__/ai-integration.test.ts`
  - `npm run test -- netlify/lib/__tests__/score-utils.test.ts`
  - Latest `npm run quality:parallel` passed with 61 test files, 545 passed tests, 2 skipped tests, 0 lint errors, and the same 3 existing `MainContent.tsx` lint warnings
  - `npm run test -- src/services/api.test.js`
  - Latest `npm run quality:parallel` passed with 61 test files, 547 passed tests, 2 skipped tests, 0 lint errors, and the same 3 existing `MainContent.tsx` lint warnings
  - `npm run test -- src/__tests__/bug-pdf-export.test.ts`
  - `npm run test -- src/__tests__/OptimizeSection.test.jsx`
  - `npm run test -- src/__tests__/bug-pdf-download.test.ts src/services/exportPdf.test.js`
  - Latest `npm run quality:parallel` passed with 61 test files, 548 passed tests, 2 skipped tests, 0 lint errors, and the same 3 existing `MainContent.tsx` lint warnings
  - `npm run test -- src/lib/utils/resumeDirection.test.ts`
  - `npm run test -- src/services/exportPdf.test.js`
  - `npm run test -- src/__tests__/TemplatesSection.test.jsx src/__tests__/template-rtl.test.tsx`
  - Latest `npm run quality:parallel` passed with 62 test files, 556 passed tests, 2 skipped tests, 0 lint errors, and the same 3 existing `MainContent.tsx` lint warnings
  - `npm run test -- netlify/lib/__tests__/sentry.test.ts`
  - `npm run test -- src/__tests__/bug-pdf-download.test.ts`
  - `npm run test -- netlify/lib/__tests__/openrouter-client.test.js`
  - `npm run test -- netlify/functions/__tests__/extract-resume-json.test.ts netlify/functions/__tests__/parse-resume.test.ts`
  - `npm run test -- netlify/functions/__tests__/ai-integration.test.ts netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts`
  - `npm run test -- netlify/functions/__tests__/user-data-api.test.ts src/services/api.test.js`
  - `npm run test -- netlify/functions/__tests__/admin-gates.test.ts netlify/lib/__tests__/rate-limiter.test.ts`
  - `npm run type:check`
  - `npm run test -- src/lib/utils/storage-migration.test.ts`
  - `npm run test -- src/__tests__/CoverLetterSection.i18n.test.tsx src/__tests__/JobMatch.test.jsx`
  - `npm run test -- src/lib/utils/storage-migration.test.ts src/__tests__/CoverLetterSection.i18n.test.tsx src/__tests__/JobMatch.test.jsx`
  - `npm run type:check`
  - `npm run lint`
  - `npm run build` passed on 2026-05-19. Vite emitted known non-blocking warnings for deprecated `esbuild` option from `vite:react-swc`, browser externalization of `node:zlib`, chunk size, and ineffective dynamic import.
  - Latest `npm run quality:parallel` passed on 2026-05-19 with lint, root `tsc --noEmit`, Netlify `tsc -p netlify/tsconfig.json --noEmit`, and Vitest all green: 66 test files passed, 576 tests passed, 2 skipped.
  - `npm run test -- src/__tests__/light-mode-contrast.test.ts` passed on 2026-05-20 with 8 tests passed.
  - `npm run quality:parallel` passed on 2026-05-20 with Vitest reporting 585 tests passed and 2 skipped.
  - `npm run build` passed on 2026-05-20 with the existing non-blocking Vite/Rolldown warnings for `vite:react-swc`, browser externalization of `node:zlib`, chunk size, and ineffective dynamic import.
- Tests/checks that failed or were not run:
  - First run of `npm run test -- netlify/lib/__tests__/rate-limiter.test.ts` failed because the test mocked `Redis` with a non-constructible arrow function; the mock was fixed and the test passed on rerun.
  - The 2026-05-19 `npm run quality:parallel` failure in `src/__tests__/light-mode-contrast.test.ts` is resolved as of 2026-05-20; the current `src/lib/styles/glass.ts` keeps the intentional `dark:bg-white/5` input and `dark:bg-gray-900/80` secondary-button classes expected by the contrast gate.
  - OAuth trust/branding checklist update was documentation-only; no automated tests were run.
- Current dirty tree snapshot:
  - `rtk git status` and `rtk git diff --stat` timed out on 2026-05-19, so native `git status --short` and `git diff --stat` were used as a narrow fallback.
  - `git status --short` reported 76 modified tracked files and 7 untracked paths.
  - Key dirty areas include backend functions/lib hardening, AI parser/scoring/rate-limit tests, frontend RTL/mobile/export/localization changes, storage-migration follow-ups already in the dirty tree, HR Super Saud follow-ups already in the dirty tree, OAuth/auth docs/tests, and this handoff document.
  - Do not assume untracked files are already part of `rtk git diff --stat`; inspect status before relying on tracked diff output.

## Completed Decisions

- `AGENTS.md` is the durable rules source.
- RTK is preferred for supported commands, but PowerShell cmdlets must not be run as RTK subcommands. Use `rtk proxy powershell -NoProfile -Command "<command>"` when PowerShell syntax is required.
- Context7 MCP should be used for current framework/library/API docs when implementation is blocked by third-party behavior.
- Creative ideas remain parked in `docs/WATHEQ_CREATIVE_IDEAS.md`.
- No third-party skill packs.
- Use relative repo paths only in project docs.
- One task per review unit; avoid mixing unrelated fixes.

## Current Working Process

- Use this plan as the priority queue. Do not infer the next task from chat memory when this file has a current recommendation.
- Before each implementation turn, read only the active task's relevant skill and focused files; avoid whole-repo scans.
- Start each task by naming the boundary touched: frontend, API, validation, persistence, logging, tests, or docs.
- If a task reveals a prerequisite defect in the same boundary, fix it only when it is required for the acceptance criteria or verification gate.
- After each completed task, update this plan in the same turn: mark completed risk items, replace the Next Recommended Task, and record focused verification.
- Keep generated artifacts out of the handoff. If a new command creates local build metadata, ignore or remove it rather than leaving it as an untracked task artifact.
- Do not start P3 creative backlog work until the active stabilization queue below is complete or explicitly deferred.

## Remaining Risk Register

### P0 / Must Fix Before Feature Expansion

- [x] No open P0 product/security blocker is known after the score, `optimize-stream` rate-limit, Arabic workspace localization, privacy/security hardening, browser persistence fixes, and resolved light-mode contrast gate mismatch. The latest full quality/build gate passed on 2026-05-20.

### P1 / Fix Soon

- [x] Referral idempotency / duplicate reward risk: `netlify/lib/referral-manager.js` now awards referral credits only after a confirmed conditional relationship write.
- [x] Netlify function TypeScript coverage gap: `npm run type:check` now includes `tsc -p netlify/tsconfig.json --noEmit`.
- [x] AI match zero-score inflation: `processMatchOnly()` now preserves valid `score: 0` and endpoint coverage proves `0` remains `0` in the response.

### P2 / Scheduled Later

- [x] Low-text/OCR regression coverage: `src/services/api.test.js` now proves low-text PDF extraction sends `kind: "file"`, includes auth headers, calls the callback, and surfaces the 422 without implying OCR support.
- [x] Signed-out export fallback mismatch: Optimize export now warns signed-out users and still reaches the browser print / Save as PDF fallback.
- [x] Mixed Arabic/English resume direction default: `mixed` language now maps to RTL for Saudi bilingual resumes with Arabic bullets and English companies/tools.
- [x] RTL PDF/DOCX export tests: behavioral tests now assert mixed Arabic content sends `direction: "rtl"` into PDF/DOCX export paths and renders RTL export HTML.
- [x] Mobile scan/upload mismatch: confirmed regression coverage in `src/__tests__/ResumeUpload.test.jsx`; visible upload affordances align with PDF/DOCX/TXT support, no camera capture path is exposed, and image uploads are rejected before parsing.
- [x] Remaining lint warnings: cleared the 3 warnings in `src/components/Layout/MainContent.tsx` (`withTemperature` unused, two unnecessary `generateClarifications` hook dependencies).

### Pre-existing Issues Discovered But Not Caused By Current Diff

- [x] Email name/refereeName logging risk: referral email logs now avoid raw names/referee names/referrer names, and notification display names are no longer derived from email local-parts.
- [x] Some localStorage keys still use old/unprefixed names such as `airo:coverLetter`, `airo:lastJobDescription`, and `workflow-panel-*`; browser persistence now uses `watheq:*` keys with compatibility-safe read-through/copy-forward aliases.
- [x] Referral reward persistence and email notification behavior reviewed after idempotency fix; duplicate/already-referred and missing-referee-row paths do not send notifications or award duplicate credits.

## Next Recommended Task

- Title: No stabilization task is currently queued after the resolved contrast-gate mismatch.
- Why it is next: `src/lib/styles/glass.ts` and `src/__tests__/light-mode-contrast.test.ts` are aligned; the focused contrast test, full quality gate, and production build all passed on 2026-05-20.
- Files likely involved:
  - None until the next user-selected stabilization task.
- Acceptance criteria:
  - Wait for the next user-approved task instead of starting creative backlog work or unrelated feature changes.
- Focused verification commands:
  - None pending.
  - Latest completed: `npm run test -- src/__tests__/light-mode-contrast.test.ts`, `npm run quality:parallel`, and `npm run build`.
  - Exact latest result: focused contrast test passed with 8 tests; full quality gate passed with 585 tests passed and 2 skipped; build passed with existing non-blocking Vite/Rolldown warnings only.
- What not to touch:
  - Do not start creative backlog work or unrelated feature changes.

## Stabilization Priority Queue

1. No queued stabilization item remains after the 2026-05-20 contrast-gate verification.

## Completed Since Last Handoff

- [x] Light-mode contrast gate mismatch resolution:
  - Inspected `src/lib/styles/glass.ts` and `src/__tests__/light-mode-contrast.test.ts`.
  - Confirmed the current `glass.ts` values are intentional and already aligned with the contrast gate: `glass.input` includes `dark:bg-white/5`, and `glass.button.secondary` includes `dark:bg-gray-900/80`.
  - No production code change was required; only this handoff document was updated.
  - Verified `npm run test -- src/__tests__/light-mode-contrast.test.ts`, `npm run quality:parallel`, and `npm run build` on 2026-05-20.
- [x] P0-1 Supabase server-client hardening:
  - Removed public anon-key fallback from `netlify/lib/supabase-client.ts`.
  - Required `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for privileged server work.
  - Tightened credits, referrals, user-data, scheduled credit jobs, waitlist notification, and feedback paths.
  - Added regression tests for service-role fail-closed behavior.
- [x] P0-2 referral auth/payload hardening:
  - Bound referral `get-link`, `get-stats`, and `track` operations to the authenticated Supabase bearer token.
  - Removed trust in request-supplied `email`, `referee_email`, and `referee_id`.
  - Fixed frontend referral calls to send auth headers instead of identity query/body fields.
  - Added referral API regression tests.
- [x] P0-3 logging and Sentry PII redaction:
  - Added shared `sanitizeSentryContext()` and `redactForLog()` in `netlify/lib/sentry.ts`.
  - Removed raw parse previews and raw AI response previews from active and legacy parse paths.
  - Replaced raw Sentry payload contexts with metadata such as lengths, booleans, language, and tone.
  - Masked direct email logs across credits, referrals, scheduled jobs, waitlist, feedback, user-data, and email service.
  - Added Sentry redaction regression tests.
- [x] P0-4 scanned/low-text product decision:
  - Active parser officially supports selectable-text PDF/DOCX/TXT and pasted text.
  - Scanned/image-only PDFs are not currently supported by the active OpenRouter parser.
  - The app no longer has an OCR provider fallback; active and legacy parser paths should reject scanned/image-only resumes clearly.
  - Frontend OCR claims and the mobile camera scan affordance were removed/softened to match parser reality.
  - Added regression coverage for scanned/empty extraction, low-text extraction, CID-font garbage, and the removed mobile scan affordance.
- [x] P0-4 OCR/privacy logging check:
  - Active parser still logs metadata only: lengths, source labels, types, and object keys.
  - No raw OCR/resume/AI previews were reintroduced.
- [x] P0-5 privacy/security hardening:
  - Extended shared redaction helpers for content fields, identity fields, bearer/JWT/API-key-like strings, and safe error summaries.
  - Replaced whole-error logs and broad Sentry payload contexts across AI, parse, optimize, Vision 2030, PDF/export, cache/rate-limit, feedback, waitlist, scheduled, and client API surfaces.
  - Required auth in `generate-pdf` before parsing/rendering resume HTML payloads and sanitized PDF filenames for response headers.
  - Reduced clarification cache TTL to 10 minutes to match sensitive resume/JD-derived output retention.
  - Kept Google OAuth, privacy policy, and terms pages untouched while external review is pending.
- [x] P0-6 full dirty-tree verification:
  - Ran the missing build gate for the Arabic workspace localization plus privacy/security hardening stack.
  - `npm run build` passed with known Vite/Rolldown warnings only.
  - `npm run quality:parallel` passed with lint, root TypeScript, Netlify TypeScript, and all Vitest files green.
  - No code changes were needed after verification; only this handoff document was updated.
- [x] P2-13 browser persistence key hygiene:
  - Inventoried old `airo:*` and unprefixed `workflow-panel-*` localStorage keys.
  - Added compatibility-safe storage helpers that copy old aliases forward to `watheq:*` keys without deleting saved data during migration/read-through.
  - Updated cover letter, Match/Optimize last job description, bulk analysis, and workflow panel persistence to write current `watheq:*` keys.
  - Added focused storage migration coverage and verified existing cover-letter/job-match old-key tests still pass.
- [x] P1-1 optimize-stream abuse protection:
  - Added `checkRateLimitForRequest()` for Netlify Functions v2 `Request` handlers.
  - Applied it to `netlify/functions/optimize-stream.ts` before auth, credit checks, cache lookup, body parsing, and AI work.
  - Added focused tests proving 429 short-circuits before expensive work.
- [x] P1-2 Redis/Upstash optimization cache TTL:
  - Optimization cache keys remain hashed.
  - Optimization cache values may contain AI response snippets derived from resume content.
  - Reduced optimization response TTL from the generic 30-minute default to 10 minutes.
- [x] P1 user data export filename privacy:
  - Removed raw email from the `Content-Disposition` export filename in `netlify/functions/user-data-api.ts`.
  - Added regression coverage for email-free export headers.
- [x] P1-3 OpenRouter/Gemini fallback and timeout coverage:
  - Identified primary OpenRouter, direct Gemini, fallback eligibility, and timeout behavior in `netlify/lib/openrouter-client.js`.
  - Added direct client regression tests for OpenRouter provider failure with Gemini fallback success, Gemini fallback failure, and timeout-to-`TimeoutError` mapping.
  - Added endpoint-level `ai-match` timeout coverage for retryable user-facing response headers and messages.
  - Kept logs and Sentry contexts metadata-only; timeout responses are not captured to Sentry.
- [x] P1-4 active/legacy parse behavior alignment:
  - Confirmed `src/services/api.js` uses active `extract-resume-json` for normal uploads, while `batch-api` can still call legacy `parse-resume`.
  - Removed the obsolete legacy OCR provider path from `parse-resume`.
  - Aligned legacy failure behavior with the active product decision: low-quality file extraction, scanned/image-only files, and unsupported files no longer return false-success parsed documents.
  - Added regression coverage for low-quality extraction rejection, scanned/image-only rejection, and unsupported file rejection.
  - Avoided Sentry capture for expected unreadable-file rejections and kept logs metadata-only.
- [x] P1-5 score invariant verification:
  - Traced score generation through `processMatchOnly()`, `ai-match`, `optimize`, `optimize-stream`, Redis cache responses, Zustand baseline score storage, and Optimize display priority.
  - Added shared backend score normalization in `netlify/lib/score-utils.ts`.
  - Clamped match and optimize scores to integer `0..100` before response, storage, cache, or UI hydration.
  - Changed streaming optimize to fail on missing score data instead of caching/displaying a fake `0` baseline.
  - Capped estimated improvement so projected scores cannot exceed `100`.
  - Added focused tests for score utility behavior, ai-match clamping, optimize score clamping, missing-score failure, streaming no-cache-on-score-failure, and existing frontend baseline drift guards.
- [x] P1-6 scheduled/dev-only production gating:
  - Added shared admin/scheduled function gates in `netlify/lib/admin-gates.ts`.
  - Scheduled credit reset and monthly summary functions now use a single Netlify-internal scheduler gate with local-development allowance.
  - Dev credit reset and celebration bonus functions now require non-local allow flags plus a configured admin secret before credit mutation.
  - Waitlist notification no longer has a default `"change-me-in-production"` admin secret and fails closed when `ADMIN_SECRET` is missing or unsafe.
  - Added focused regression tests proving failed gates stop before service-role Supabase work, credit mutation, or waitlist email sends.
- [x] P2-1 mobile scan/upload affordance alignment:
  - Confirmed the main upload picker is limited to `.pdf,.docx,.txt` and has no mobile camera `capture` path.
  - Removed stale `scanResume` locale copy and kept visible upload actions to file selection only.
  - Aligned upload card copy and format chips with active parser support for PDF, DOCX, TXT, or pasted text.
  - Added focused upload tests for TXT visibility, file input accept/capture attributes, missing scan button, and image-upload rejection before parsing.
- [x] P2-2 Arabic/RTL template preview and export:
  - Added shared resume direction detection in `src/lib/utils/resumeDirection.ts`.
  - Template preview wrappers and registered template roots now receive RTL/LTR direction instead of forcing LTR.
  - Server PDF generation receives a sanitized direction value and renders the outer document with matching `dir`.
  - DOCX export accepts direction and applies bidirectional/right-to-left paragraph and text-run options for Arabic output.
  - Added focused RTL preview regression coverage for Arabic resume rendering.
- [x] P2-3 mobile responsive checks:
  - Added 360px, 390px, and 768px responsive contracts for upload controls, workspace tab scrolling, optimize filter tabs/cards/toast, template preview, floating template selector, and mobile export controls.
  - Fixed optimize header/card layout guards with `min-w-0`, `shrink-0`, wrapping action rows, long-text wrapping, stacked mobile card actions, and viewport-safe loading toast positioning.
  - Kept changes scoped to responsive behavior and regression checks; export semantics were not changed.
- [x] P2-4 export flow clarity:
  - Confirmed Templates export is direct file export: server/client PDF generation and client DOCX generation.
  - Confirmed Optimize export uses the existing merged-resume HTML path, saving to Supabase when available and falling back to browser print / Save as PDF.
  - Added an explicit Optimize export control labeled `Save HTML / Print PDF` and clarified Templates mobile/desktop DOCX/PDF labels without changing export semantics.
  - Added focused regression coverage for the optimized export label, disabled state, and `onExport('styled', 'supabase')` call.
- [x] P2-5 fixed A4 template scaling review:
  - Reworked template preview scale calculation for mobile, tablet, small desktop, and desktop widths so the fixed A4 canvas fits the available preview area.
  - Moved formatting panel and zoom controls from `md` to `lg` so tablet viewports do not lose width to desktop-only controls.
  - Preserved PDF/DOCX export semantics and direction-aware export behavior.
  - Added focused checks for 360px, 390px, and 768px preview scale bounds, tablet scale below desktop scale, and large-screen-only formatting/zoom controls.
- [x] P2-6 privacy/compliance navigation reachability:
  - Mounted the global footer in the app shell with reachable Privacy Policy and privacy contact links.
  - Added a minimal SPA path switch so `/privacy` renders the existing `src/pages/PrivacyPolicy.tsx` page instead of the workspace.
  - Added a Privacy Policy link to the consent banner footer.
  - Kept policy content unchanged and added focused tests for footer links and `/privacy` routing behavior.
- [x] P2-7 Arabic/English workflow verification:
  - Added direct `DirectionProvider` tests for English/LTR and Arabic/RTL document attributes and font-family switching.
  - Confirmed existing upload, optimize, template, RTL preview, and export direction tests cover the main workflow surfaces.
  - Fixed cover-letter Arabic result presentation so the document preview, greeting, closing, and DOCX export use Arabic/RTL direction-aware behavior.
  - Added cover-letter bilingual tests for Arabic tone labels, RTL document chrome, English tone labels, and LTR document chrome.
- [x] P1-7 referral idempotency:
  - Changed `trackReferral()` to claim the referral relationship with a conditional Supabase update requiring `referred_by_email IS NULL`.
  - Rewards are now paid only when that update returns the referee row.
  - Added regression tests for confirmed reward, duplicate tracking without reward, and missing referee credit row without reward.
  - Verified referral manager tests, referral API tests, and full `npm run quality:parallel`.
- [x] P1-8 Netlify TypeScript coverage:
  - Wired `npm run type:check` to run root `tsc --noEmit` and `tsc -p netlify/tsconfig.json --noEmit`.
  - Added `netlify/tsconfig.json` build-info isolation through `.tsbuildinfo.netlify`.
  - Fixed exposed backend TypeScript issues in admin gate narrowing and focused tests.
  - Added `.tsbuildinfo.*` to `.gitignore` so backend typecheck metadata remains local.
  - Verified backend `tsc`, `npm run type:check`, focused admin/rate-limit/stream tests, and full `npm run quality:parallel`.
- [x] P1-9 AI match zero-score preservation:
  - Replaced the truthy score fallback in `processMatchOnly()` with a nullish fallback so valid `0` is not converted to `50`.
  - Added direct AI-client regression coverage in `netlify/lib/__tests__/gemini-client.test.js`.
  - Added endpoint-level regression coverage in `netlify/functions/__tests__/ai-integration.test.ts`.
  - Verified direct Gemini client test, AI integration test, score utilities, `npm run type:check`, and full `npm run quality:parallel`.
- [x] P2-8 low-text/OCR service regression:
  - Added service-level tests in `src/services/api.test.js` for low-text PDF fallback and readable PDF fast path.
  - Proved low-text extraction sends `kind: "file"` with auth headers, calls `onOcrFallback`, and surfaces a 422 scanned/image-only message without OCR-support claims.
  - Proved readable client-extracted PDF text still sends `kind: "text"` and does not call the fallback callback.
  - Verified `npm run test -- src/services/api.test.js` and full `npm run quality:parallel`.
- [x] P2-9 signed-out Optimize export fallback:
  - Changed `handleExportPdf()` so unauthenticated Supabase-first exports warn the user but continue into the existing print fallback.
  - Kept signed-in Supabase storage behavior intact behind `canSaveToSupabase`.
  - Added a regression in `src/__tests__/bug-pdf-export.test.ts` preventing a signed-out early return from reappearing.
  - Verified Optimize export clarity tests, PDF export/download tests, `npm run type:check`, and full `npm run quality:parallel`.
- [x] P2-10 mixed Arabic/English direction and RTL export coverage:
  - Updated `detectResumeDirection()` and `directionFromLanguage()` so `mixed` content resolves to RTL.
  - Added focused direction utility tests for mixed Saudi bilingual content and English-only content.
  - Updated Optimize print/export HTML generation to render `lang="ar" dir="rtl"` and RTL body/list styles for Arabic or mixed content.
  - Added Templates tests proving mixed content uses RTL preview direction and sends RTL into server PDF and DOCX export calls.
  - Verified focused direction/export/template tests, `npm run type:check`, and full `npm run quality:parallel`.
- [x] P2-11 mobile scan/upload regression confirmation:
  - Confirmed existing upload coverage proves the main file input accepts only `.pdf,.docx,.txt` and does not expose `capture`.
  - Confirmed visible upload controls do not expose a scan button and image uploads are rejected before parsing.
  - Verified `npm run test -- src/__tests__/ResumeUpload.test.jsx` with 9 passing tests.
- [x] P2-12 `MainContent.tsx` lint cleanup:
  - Removed the unused `withTemperature` helper.
  - Removed imported `generateClarifications` from two hook dependency arrays without changing clarification behavior.
  - Verified `rtk lint` reports no issues.
  - Verified `npm run quality:parallel` passed with 62 test files, 556 passed tests, 2 skipped tests, and 0 lint/type errors.

## Continuation Checklist

- [ ] Start with `AGENTS.md` and this plan.
- [ ] Read `docs/WATHEQ_CREATIVE_IDEAS.md` only when explicitly working on backlog triage or when a user asks about creative ideas.
- [ ] Read `.agents/skills/*/SKILL.md` only when the next task clearly matches a focused skill.
- [ ] Use `rtk` for compatible reads/status/searches; record fallback when `rtk` cannot run a command cleanly.
- [ ] Use Context7 MCP for uncertain third-party API/library behavior.
- [ ] Use OpenAI Docs MCP for OpenAI-specific model/API/prompting details.
- [ ] Before editing, diagnose the data flow and affected frontend, API, validation, persistence, logging, and tests.
- [ ] Keep each P0 task narrow; avoid creative backlog or unrelated refactors.
- [ ] After edits, run focused tests first, then `npm run quality:parallel` when feasible.
- [ ] Preserve privacy rules: no resume/job/OCR/AI raw content in logs or Sentry contexts.

## Next Session Bootstrap Prompt

### Prompt to start the next Codex session

```text
Read AGENTS.md and docs/WATHEQ_ENGINEERING_PLAN.md first.
Read .agents/skills/*/SKILL.md only if the next task clearly matches a focused skill.

Run:
- rtk git status
- rtk git diff --stat

Then summarize the current state, identify the Next Recommended Task from docs/WATHEQ_ENGINEERING_PLAN.md, and ask for approval before editing.

Do not scan the whole repo unless the plan requires it.
Do not implement creative backlog items.
Do not mix unrelated fixes.
Use docs/WATHEQ_ENGINEERING_PLAN.md as the continuation source instead of relying on chat history.
```

## Token-Control Rules

- Do not reread the whole repo unless the plan says it is needed.
- Use `docs/WATHEQ_ENGINEERING_PLAN.md` as the state source.
- Use RTK commands when useful.
- Prefer diff summaries before full diffs.
- Keep each task in a separate branch/thread.

## 1. Executive Summary

Watheq is a React 19 + Vite SPA backed by Netlify Functions, Supabase, and an OpenRouter/Gemini AI resume pipeline. The current architecture is functional and already has important safeguards around schema validation, auth-gated AI actions, credits, and applied-only optimization behavior.

The most important engineering theme before feature expansion is tightening trust boundaries around resume PII, service-role Supabase access, AI fallbacks, parser failure handling, logging, and persistence. Creative product ideas are tracked separately in `docs/WATHEQ_CREATIVE_IDEAS.md`; this document focuses only on engineering stabilization and implementation readiness.

## 2. Architecture Map

- [ ] Frontend app shell: React 19 + Vite SPA starts in `src/main.tsx`, renders `src/App.tsx`, and uses internal tab navigation in `src/components/Layout/MainContent.tsx` rather than a route library.
- [ ] Workspace screens: Resume upload, Match, Optimize, Templates, Interview, Bulk, Cover Letter, and Vision 2030 are organized as tabs, with heavier sections lazy-loaded from `src/components/sections/`.
- [ ] State and persistence: resume state is primarily managed by Zustand in `src/lib/stores/resumeStore.ts`, with resume/job data also persisted in localStorage keys such as `watheq:resumeData` and `watheq:lastJobDescription`.
- [ ] Styling and localization: Tailwind CSS v4 is imported through `src/index.css`, design tokens live in `src/styles/theme.css`, and Arabic/RTL behavior is coordinated through `src/lib/i18n.ts` and `src/components/providers/DirectionProvider.tsx`.
- [ ] Client API boundary: `src/services/api.js` sends Supabase bearer tokens and resume/job payloads to Netlify Functions under `/.netlify/functions/*` and `/api/optimize-stream`.
- [ ] AI parsing path: upload/paste flows through browser-side PDF/DOCX/text extraction in `src/lib/utils/resumeText.ts`, then `netlify/functions/extract-resume-json.ts`, then parsing helpers in `netlify/lib/gemini-client.js`.
- [ ] Match path: `netlify/functions/ai-match.ts` validates input, checks auth/credits, calls match scoring through `netlify/lib/gemini-client.js`, consumes credits, and asynchronously stores a truncated match record.
- [ ] Optimization path: `netlify/functions/optimize-stream.ts` is the preferred SSE path, with `netlify/functions/optimize.ts` as fallback. Both use schema validation, credits, vulnerability detection, Redis/Upstash cache helpers in `netlify/lib/redis-cache.ts`, and OpenRouter/Gemini calls.
- [ ] AI provider boundary: `netlify/lib/openrouter-client.js` centralizes OpenRouter requests, Gemini fallback, model tiering, JSON-schema response formatting, token logging, and timeouts.
- [ ] Backend persistence: Supabase auth, credits, referrals, feedback, waitlist, storage, and migrations live across `src/services/supabase.js`, `netlify/lib/supabase-client.ts`, `netlify/lib/credit-manager.js`, `netlify/lib/referral-manager.js`, and `supabase/migrations/`.
- [ ] Export surfaces: resume previews and PDF/DOCX export are mainly in `src/components/sections/TemplatesSection.tsx`, `src/services/exportDocx.ts`, `src/services/exportPdf.js`, and `netlify/functions/generate-pdf.ts`.

## 3. Security/Privacy Risk Register

- [x] P0: `netlify/lib/supabase-client.ts` can fall back from `SUPABASE_SERVICE_ROLE_KEY` to `VITE_SUPABASE_ANON_KEY`, which conflicts with the server-side boundary and can make privileged functions fail silently under RLS.
- [x] P0: referral flows appear to accept supplied identity fields without consistently binding them to the authenticated Supabase user, especially across `src/hooks/useAuth.tsx`, `netlify/functions/referral-api.ts`, and `netlify/lib/referral-manager.js`.
- [x] P0: resume PII may leak into Netlify logs or Sentry contexts through parse previews, request payload capture, and detailed error/debug output in AI-related functions.
- [x] P0: the active parse route `netlify/functions/extract-resume-json.ts` previously implied fallback handling for scanned or low-text documents; parser behavior now rejects scanned/image-only documents clearly because no OCR provider is part of the app.
- [x] P1: full or partial resume/job content persists in localStorage, Supabase match records, Redis/Upstash optimization cache, and PDF HTML payloads; retention and redaction policies need explicit review.
- [x] P1: `netlify/functions/optimize-stream.ts` uses Netlify Functions v2 streaming and does not clearly share the same `withRateLimit` wrapper coverage as v1 functions.
- [x] P1: development-only credit mutation functions need production gating review before wider rollout.
- [x] P2: mobile scan/upload UI previously exposed an image capture path while validation supported PDF/DOCX/TXT; visible upload affordances and regression tests now match supported parser inputs.
- [x] P2: Arabic resume rendering/export can be forced LTR in template output, risking broken Arabic/RTL PDFs and previews.
- [ ] P2: export behavior is fragmented between template PDF/DOCX export and optimize HTML/print export paths.

## 4. P0 Tasks — Must Fix Before Feature Expansion

- [x] Remove the server Supabase anon-key fallback and fail closed when `SUPABASE_SERVICE_ROLE_KEY` is missing.
- [x] Audit every Netlify Function using `getSupabaseClient()` and confirm expected behavior when service-role configuration is missing.
- [x] Bind referral API operations to the authenticated user instead of trusting request-supplied email or user identifiers.
- [x] Fix the referral payload mismatch between `src/hooks/useAuth.tsx` and `netlify/functions/referral-api.ts`.
- [x] Add a logging redaction policy for resume text, job descriptions, OCR output, email, phone, names, and raw AI payloads.
- [x] Remove or sanitize parse/debug previews and Sentry contexts that can contain resume/job PII.
- [x] Decide the supported OCR fallback path for scanned PDFs and align frontend copy, endpoint routing, and backend behavior.
- [x] Add targeted regression tests for scanned/low-text parse behavior.

## 5. P1 Tasks — Reliability/Correctness

- [x] Apply rate limiting or equivalent abuse protection to `netlify/functions/optimize-stream.ts`.
- [x] Review Redis/Upstash optimization cache contents, TTL, key strategy, and data minimization expectations.
- [x] Document what resume/job data is stored in localStorage, Supabase, Redis/Upstash, Sentry, and function logs.
- [x] Add tests covering OpenRouter/Gemini fallback behavior, timeout handling, and user-facing retry messages.
- [x] Align active parse behavior between `extract-resume-json.ts` and any still-supported legacy `parse-resume.ts` code.
- [x] Verify score invariants across match, optimize, cache hydration, Zustand state, and display components.
- [x] Review scheduled and dev-only functions for production gating, admin secrets, and environment checks.
- [x] Confirm user data export/delete functions do not expose raw email or unnecessary PII in headers, logs, or filenames.

## 5.1 Persistence And Retention Notes

- Browser localStorage stores full parsed resume state in `watheq:resumeData`, the last job description in `watheq:lastJobDescription`, and persisted Zustand state under `resume-storage`, including parsed resume text, selected template, applied optimization state, metrics, and a 30-minute in-browser match-analysis cache.
- Bulk analysis stores local-only summaries under `airo:bulkAnalysis`; raw uploaded file bytes are not persisted there, but parsed text can exist in memory while processing.
- Supabase stores user profile/credit/referral records and, where enabled, resume/job-match records. Match storage paths should remain truncated/minimized and service-role-only on the server boundary.
- Redis/Upstash stores hashed cache keys. Optimization response values can include AI response snippets derived from resume content, so v1/v2 optimize caches now use a 10-minute TTL.
- Sentry contexts should contain metadata only through `sanitizeSentryContext()`: lengths, booleans, counts, and status fields rather than raw resume, job, OCR, HTML, or AI text.
- Function logs should use counts, lengths, object keys, status, and redacted identifiers. Do not log raw resume/job/OCR/AI content or raw emails.

## 6. P2 Tasks — Mobile/UX/Export

- [x] Fix or remove the mobile image scan affordance so accepted file types match actual parsing support.
- [x] Make template preview and export direction-aware for Arabic/RTL resumes.
- [x] Add mobile checks for 360px, 390px, and tablet widths across upload, tabs, optimize cards, template preview, and export.
- [x] Unify or clearly separate Templates export and Optimize export so users understand whether they are downloading PDF, DOCX, HTML, or opening print flow.
- [x] Review fixed A4 template scaling on mobile for clipping, overflow, zoom controls, and touch usability.
- [x] Ensure privacy/compliance navigation is wired if `src/pages/PrivacyPolicy.tsx` is intended to be reachable.
- [x] Verify Arabic and English flows for upload, match, optimize, templates, cover letter, and PDF/DOCX export.

## 7. P3 Creative Backlog Placeholder

- [ ] Keep creative product ideas, experimental UX concepts, and non-stabilization opportunities in `docs/WATHEQ_CREATIVE_IDEAS.md`.
- [ ] Do not mix creative backlog items into P0/P1/P2 unless they resolve a concrete security, reliability, correctness, mobile, or export issue.

## 8. Recommended Next Implementation Task

- [ ] Fix referral idempotency before awarding referral credits:
  - Make referral tracking atomic/idempotent in `netlify/lib/referral-manager.js`.
  - Award credits only after a confirmed unique referral relationship write.
  - Add focused regression coverage in `netlify/lib/__tests__/referral-manager.test.js`.
  - Run `npm run test -- netlify/lib/__tests__/referral-manager.test.js` and `npm run test -- netlify/functions/__tests__/referral-api.test.ts`.

Do not start P3 creative planning until remaining P1/P2 stabilization risks are handled or explicitly deferred by the user.

## 9. Verification Command Matrix

- [ ] Full quality gate after code changes: `npm run quality:parallel`.
- [ ] Unit/integration test suite: `npm run test`.
- [ ] TypeScript check: `npm run type:check`.
- [ ] ESLint check: `npm run lint`.
- [ ] Production build: `npm run build`.
- [ ] Local frontend smoke: `npm run dev`.
- [ ] Local Netlify/functions smoke: `npm run dev:netlify`.
- [ ] Focused frontend upload/export tests: `npm run test -- src/__tests__/ResumeUpload.test.jsx src/__tests__/TemplatesSection.test.jsx src/__tests__/bug-pdf-export.test.ts src/__tests__/bug-pdf-download.test.ts`.
- [ ] Focused AI/backend tests: `npm run test -- netlify/functions/__tests__/extract-resume-json.test.ts netlify/functions/__tests__/parse-resume.test.ts netlify/functions/__tests__/resume-schemas.test.ts netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/ai-integration.test.ts`.
- [ ] Focused OpenRouter fallback tests: `npm run test -- netlify/lib/__tests__/openrouter-client.test.js netlify/functions/__tests__/ai-integration.test.ts`.
- [ ] Focused state/scoring tests: `npm run test -- src/lib/stores/resumeStore.test.ts src/__tests__/matchScore.fixture.test.js src/__tests__/bug-score-display.test.tsx`.
- [ ] Focused score invariant tests: `npm run test -- netlify/lib/__tests__/score-utils.test.ts netlify/functions/__tests__/ai-integration.test.ts netlify/functions/__tests__/optimize.test.ts netlify/functions/__tests__/optimize-stream.test.ts src/__tests__/matchScore.fixture.test.js src/__tests__/optimize-score-override-bug.test.jsx src/__tests__/score-drift-bug.test.jsx`.
- [ ] Security inspection for service-role/logging/rate-limit patterns: `Select-String -Path netlify\functions\*.ts,netlify\lib\*.ts,netlify\lib\*.js -Pattern "VITE_SUPABASE_ANON_KEY|SERVICE_ROLE_KEY|withRateLimit|console\.log|console\.error"`.
- [ ] Security inspection for scheduled/admin/auth boundaries: `Select-String -Path netlify\functions\*.ts -Pattern "x-netlify-internal-functions|ADMIN_SECRET|Authorization|Access-Control-Allow-Origin"`.
- [ ] Migration/RLS inspection: `Select-String -Path supabase\migrations\*.sql -Pattern "security definer|enable row level security|create policy|auth.jwt|service_role"`.
- [ ] Focused service-role tests: `npm run test -- netlify/lib/__tests__/supabase-client.test.ts netlify/lib/__tests__/credit-manager.test.js`.
- [ ] Focused referral tests: `npm run test -- netlify/functions/__tests__/referral-api.test.ts netlify/lib/__tests__/referral-manager.test.js src/__tests__/useAuth.test.jsx`.
- [ ] Focused redaction tests: `npm run test -- netlify/lib/__tests__/sentry.test.ts netlify/functions/__tests__/extract-resume-json.test.ts netlify/functions/__tests__/parse-resume.test.ts netlify/functions/__tests__/ai-integration.test.ts`.

## 10. Subagent Strategy

- [ ] Frontend/mobile UX subagent: own tab routing, responsive layout, upload affordances, Arabic/RTL display, template preview, and export UX analysis.
- [ ] AI resume pipeline subagent: own upload/input, browser extraction, parse/match/optimize functions, OpenRouter/Gemini behavior, schemas, scoring, unsupported scanned-document handling, and AI response handling.
- [ ] Netlify/Supabase/security subagent: own functions, Supabase clients, auth, credits, referrals, scheduled functions, migrations, env vars, logging, persistence, rate limits, and PII risks.
- [ ] Main agent: reconcile findings, keep priorities consistent, avoid duplicate work, and turn the subagent outputs into implementation-ready tasks without broadening scope.
