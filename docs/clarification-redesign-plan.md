# Clarification redesign — implementation plan for Claude Code

Target repo: `resume-customizer` (Watheq).

## Decisions locked

- Keep the broad gap trigger. Do NOT narrow to "significant shift only." The hard-stop option makes false positives cheap (one click), so broad firing is fine.
- Convert free-text questions to selectable options.
- Every question ends with two escapes: an "Other" free-text option and a terminal hard-stop option ("I don't have this / I never do this").

## How it works today (verified)

- `netlify/functions/generate-clarifications.ts` calls the `clarification_questions` contract (free, cached 600s, non-fatal → returns `{clarifications: []}` on error).
- Contract lives in `netlify/lib/ai-contracts/contracts/index.js`: `clarificationJsonSchema`, `clarificationOutput` (zod), `buildClarificationMessages`, registered as `clarification_questions` (modelType `flash`, maxTokens 2048, reasoningBudget 512).
- Each question = `{id, theme, rationale, question}`.
- `src/components/modals/ClarificationModal.tsx` renders free-text textareas, gibberish guard (≥3 words), skip (button + Escape + backdrop), regenerate icon, submit needs ≥1 valid answer.
- `src/components/Layout/MainContent.tsx`: `formatClarifications` turns answers into `[theme]\nQ:\nA:` text; `handleClarificationSubmit/Skip` resume the optimize flow.
- Answers reach the optimizer through `optionalTaggedBlock('user_clarifications', input.userClarifications)` in the optimize message builder (same file, near the `vulnerabilityBlock`). The legacy path is in `netlify/lib/gemini-client.js`.

## The critical risk

`CLAUDE.md` rule: "Missing JD keywords must be woven INTO rewritten bullets." That rule will fabricate a skill the moment the JD names it, even after the user said they don't have it. The hard-stop is cosmetic unless it flows through as a negative constraint that overrides keyword weaving, in BOTH the OpenRouter contract optimize prompt and `gemini-client.js`.

---

# Phase 1 — Core redesign (ship this together)

## 1. Schema changes

File: `netlify/lib/ai-contracts/contracts/index.js`

Extend `clarificationJsonSchema` and `clarificationOutput` item shape:

```
{
  id: string,
  theme: string,
  rationale: string,
  question: string,
  type: 'single' | 'multi',        // selection mode
  options: [
    { value: string, label: string, isHardStop?: boolean }
  ],
  allowOther: boolean              // renders the "Other" free-text field
}
```

Rules for the AI to follow (enforce in `buildClarificationMessages`):

- Max 4 real options per question (mirror AskUserQuestion), plus the auto-added Other and hard-stop handled by the UI if the model omits them.
- The model must always include exactly one option with `isHardStop: true` as the last option (e.g. "I don't have this experience").
- `allowOther: true` by default.
- For numeric/metric questions, still use options as ranges (e.g. "1–3", "4–10", "10+") and rely on Other for exact values.
- Keep the existing "return empty array if already well quantified" escape.

Bump contract `maxTokens` from 2048 to ~3072 to fit options. Leave reasoningBudget at 512.

## 2. Prompt changes

File: same, `buildClarificationMessages`.

- Instruct the model to produce options, set `type`, mark the hard-stop, and set `allowOther`.
- Keep firing on gaps: missing metrics, tool/skill the JD requires but the resume doesn't evidence, equivalency. (No shift-only narrowing.)
- Keep Arabic instruction: translate `theme`, `rationale`, `question`, and option `label`; keep `id`, `value`, and English ATS keywords in English.

## 3. Modal UI

File: `src/components/modals/ClarificationModal.tsx`

- Replace textarea-per-question with option buttons/checkboxes driven by `type`.
- Render Other as a free-text input shown when `allowOther` and the user picks "Other".
- Hard-stop exclusivity: selecting the `isHardStop` option clears all other selections for that question (and vice versa).
- Keep skip (button + Escape + backdrop) and regenerate.
- Submit enabled when at least one question has a selection or Other text. Drop the ≥3-word gibberish guard for option clicks; keep it only for Other free-text.
- Smart default: if the contract marks a most-likely option, pre-select it so the common case is one confirming click. (Optional model field `defaultValue`; skip if it complicates the schema.)

Update `ClarificationQuestion` interface and `ClarificationModalProps` (`onSubmit` now returns structured selections, not `Record<string,string>`).

## 4. Answer formatting → two blocks

File: `src/components/Layout/MainContent.tsx`, `formatClarifications`.

Split output into two tagged blocks instead of one Q/A block:

- Positive evidence: selected non-hard-stop options + Other text → feeds the existing `user_clarifications` block.
- Suppression list: every `isHardStop` selection → new `user_hard_stops` block (a flat list of skills/tools/domains the user confirmed they do NOT have).

Pass both into `handleOptimizeActual` (extend `pendingOptimizeArgs` and the optimize call args).

## 5. Suppression enforcement (the teeth)

Files: `netlify/lib/ai-contracts/contracts/index.js` (optimize message builder) AND `netlify/lib/gemini-client.js`.

- Add `optionalTaggedBlock('user_hard_stops', input.userHardStops)` next to the `user_clarifications` block.
- Add an explicit instruction to the optimize system/user prompt:

```
The user explicitly confirmed NO experience with the items in user_hard_stops.
Do NOT add, imply, infer, or weave any of them into bullets, summary, headline, or skills.
Remove them from missing_keywords suggestions. This overrides any keyword-weaving rule.
```

- Thread `userHardStops` through: `src/services/api.js` optimize call → `optimize-stream.ts` / `optimize.ts` → schema (`OptimizeRequestSchema` in `netlify/lib/resume-schemas.ts`, add optional `userHardStops: string[]`) → message builder.

## 6. i18n + tests

- `src/locales/en/clarificationModal.json` and `ar/clarificationModal.json`: add option/hard-stop/Other strings.
- Update `src/__tests__/MainContent.test.jsx` (structured answers), `src/services/api.test.js`, `netlify/lib/__tests__/ai-contracts.test.js` (new schema fields).
- Run `npm run quality:parallel` until zero errors (non-negotiable per repo rules).

---

# Phase 2 — Enhancements (can ship after Phase 1)

## E1. Gate on deterministic signal before the AI call

Reuse `netlify/lib/vulnerability-detector.ts` (pivots, gaps) and the match score from the match step. Only call `generate-clarifications` when there is a real gap or a low match score. On the clean path, skip the flash call entirely. Cheaper and faster, and it answers the original "shift" intent without a new model round-trip. (Low effort, high payoff. Do this one.)

## E2. Persistent "won't claim" truth profile

Store hard-stop answers in localStorage under `watheq:hardStops`. On the next optimization for a different JD, pre-load them so the user never re-answers "no Excel." Filter the new questions against this list before showing the modal. Retention feature, matches the north-star metric. Keep it a flat string list, no infra.

## E3. Feed hard-stops into TruthCheck

Pass `user_hard_stops` to the truth-check contract (`buildTruthCheckMessages`) so it pre-empts fabrication of those items instead of catching it after the fact.

## E4. Analytics

Track skip rate, hard-stop selection rate, and answered-vs-skipped score delta. Validation signal for whether the feature earns its place. Use the existing logging/Sentry path; no new dependency.

---

# Suggested order for Claude Code

1. Schema + prompt (Phase 1.1–1.2).
2. Suppression plumbing end to end (1.5) — highest risk, do it early and test fabrication is blocked.
3. Modal UI (1.3) + answer formatting (1.4).
4. i18n + tests (1.6), `quality:parallel` green.
5. E1 gating, then E2/E3/E4 as separate commits.

# Acceptance checks

- A question renders options, an Other field, and a final hard-stop option.
- Selecting the hard-stop clears other selections for that question.
- Skip still proceeds with no answers.
- With a hard-stop on "Excel" and a JD that demands Excel: the optimized output contains no Excel claim, and Excel is gone from `missing_keywords`. Verify in both the OpenRouter and gemini paths.
- `npm run quality:parallel` passes with zero errors.
