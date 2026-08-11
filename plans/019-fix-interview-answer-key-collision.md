# Plan 019: Stop InterviewSection from overwriting saved practice answers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d2fba38..HEAD -- src/components/sections/InterviewSection.tsx`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d2fba38`, 2026-08-08

## Why this matters

`InterviewSection` keys two pieces of user state — which cards are expanded,
and the practice answers the user has typed — off **array positions**. But it
renders two different lists from two different arrays, and keys both off
positions in *different* index spaces. A third index space is used when
exporting to CSV.

The result: as soon as a generated question set contains at least one
vulnerability question, the first vulnerability card and the first standard
card share a state slot. Expanding one visibly expands the other, and — worse —
**typing a practice answer under one silently overwrites the other's answer**.
Changing the skill filter re-indexes the standard list and shifts the collision
onto different pairs.

This is user-authored text being destroyed in a feature that costs 3 credits per
generation. The fix is small: key the state off the question itself rather than
its position.

## Current state

### The state, keyed by number

`src/components/sections/InterviewSection.tsx:265-266`:

```tsx
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [savedAnswers, setSavedAnswers] = useState<Record<number, string>>({});
```

### Three different index spaces

`src/components/sections/InterviewSection.tsx:282-294` partitions the questions:

```tsx
  const vulnerabilityQuestions = useMemo(() =>
    questions.filter(q => q.vulnerabilityType),
    [questions]);

  const standardQuestions = useMemo(() =>
    questions.filter(q => !q.vulnerabilityType),
    [questions]);

  // Filter standard questions by selected skill
  const filteredQuestions = useMemo(() => {
    if (!skillFilter) return standardQuestions;
    return standardQuestions.filter(q => q.skills_tested?.includes(skillFilter));
  }, [standardQuestions, skillFilter]);
```

**Space A** — the vulnerability list keys off a position in the *full*
`questions` array (`:717-718`, `:725`, `:732`, `:847-848`):

```tsx
                {vulnerabilityQuestions.map((question, index) => {
                  const globalIdx = questions.indexOf(question);
```
```tsx
                        expandedQuestions.has(globalIdx) ? "ring-1 ring-amber-500/30" : "hover:border-amber-500/30"
```
```tsx
                        onClick={() => toggleQuestion(globalIdx)}
```
```tsx
                              value={savedAnswers[globalIdx] || ''}
                              onChange={(e) => setSavedAnswers(prev => ({ ...prev, [globalIdx]: e.target.value }))}
```

**Space B** — the standard list keys off a position in `filteredQuestions`
(`:952`, `:958`, `:966`, `:1101-1102`):

```tsx
            {filteredQuestions.map((question, index) => (
```
```tsx
                  expandedQuestions.has(index) ? "ring-1 ring-emerald-500/30" : "hover:border-gray-200 dark:hover:border-white/10"
```
```tsx
                  onClick={() => toggleQuestion(index)}
```
```tsx
                        value={savedAnswers[index] || ''}
                        onChange={(e) => setSavedAnswers(prev => ({ ...prev, [index]: e.target.value }))}
```

**Space C** — the CSV export keys off a position in the *full* `questions`
array again, but computed independently (`:497-504`):

```tsx
    const rows = questions.map((q, idx) => [
      idx + 1,
      `"${(q.question || '').replace(/"/g, '""')}"`,
      q.type,
      q.difficulty,
      q.category,
      `"${(savedAnswers[idx] || '').replace(/"/g, '""')}"`
    ]);
```

### Worked example of the collision

With `questions = [V, S1, S2]` where `V` has a `vulnerabilityType`:

- `vulnerabilityQuestions = [V]` → `V`'s `globalIdx = questions.indexOf(V) = 0`
- `filteredQuestions = [S1, S2]` → `S1`'s `index = 0`, `S2`'s `index = 1`

`V` and `S1` both read and write slot `0`. One vulnerability question is enough.

### The toggle helper

`src/components/sections/InterviewSection.tsx:480-486`:

```tsx
  const toggleQuestion = (index: number) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.has(index) ? newSet.delete(index) : newSet.add(index);
      return newSet;
    });
  };
```

### Why you must NOT add a persisted `id` field

The obvious fix — add `id` to the `Question` interface and generate it in
`normalizeQuestion` — is **wrong here**, because the localStorage load path does
not re-normalize. `src/components/sections/InterviewSection.tsx:463-473`:

```tsx
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.questions?.length) {
            setQuestions(parsed.questions);
```

`setQuestions(parsed.questions)` assigns the raw parsed objects. Every user with
a cached question set written before your change would load questions with
`id === undefined`, and **all of them would collide on the single key
`undefined`** — turning a partial bug into a total one.

Instead, key off the question text, which is already present on every question
(cached or fresh) and is already what the component trusts as a stable React
identity today — `:721` uses `key={`vuln-${question.question}`}` and `:954` uses
`key={question.question}`. Using it for state keys makes no new uniqueness
assumption beyond the one the render already makes, and requires no data
migration.

### Repo conventions

- Never use `any`; the file is TypeScript with a local `Question` interface at
  `src/components/sections/InterviewSection.tsx:37-46`.
- Logging is prefixed `[InterviewSection]` (see `:475`).
- Imports from `src/` use the `@/` alias, though this file uses relative paths
  for its local siblings — match whatever the surrounding lines already do.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run type:check` | exit 0, no errors |
| New test file | `npx vitest run src/__tests__/InterviewSection.test.tsx` | all pass |
| Lint | `npm run lint` | exit 0 |
| Full suite | `npm run test` | exit 0 (181 files) |

The full suite takes ~12 minutes. Run it once at the end.

## Scope

**In scope:**
- `src/components/sections/InterviewSection.tsx`
- `src/__tests__/InterviewSection.test.tsx` (create — no test file exists for this component)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- The `Question` interface's persisted shape and `normalizeQuestion` — adding a
  field there breaks cached data, as explained above.
- The localStorage `STORAGE_KEY` payload format and the `parsed.questions`
  load path. Changing it forces a cache migration this plan deliberately avoids.
- `netlify/functions/predict-questions.ts` and the AI contract — the server
  response shape is fine; this is purely a client state-keying bug.
- The credit gating, confirm modal, and regenerate flow in this component.
- Any restyling, refactor, or extraction of this 1134-line component.

## Git workflow

- Branch: `advisor/019-interview-answer-key-collision`
- Conventional commits, matching `git log` style.
  Suggested: `fix(interview): key practice answers by question, not array index`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Change the state key type to `string`

In `src/components/sections/InterviewSection.tsx:265-266`, change:

```tsx
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
```

Add a single helper near the other module-level helpers (above the component,
alongside `normalizeQuestion` at `:205`) that derives the key. Keep it trivial
and total — it must never return `undefined`:

```tsx
// State key for a question. Uses the question text, which is already what the
// rendered lists use as their React key, so this adds no new uniqueness
// assumption — and unlike a generated id it works for question sets restored
// from localStorage, which are NOT re-normalized on load.
const questionKey = (question: Question): string => question.question;
```

Update `toggleQuestion` at `:480` to take a `string`:

```tsx
  const toggleQuestion = (key: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      return newSet;
    });
  };
```

**Verify**: `npm run type:check` → it will now report errors at every call site
you have not yet updated. That is expected and is your worklist for Step 2.

### Step 2: Update all three index spaces to use the key

**Space A — vulnerability list.** Delete the `globalIdx` line at `:718`
entirely (`const globalIdx = questions.indexOf(question);` — it is no longer
needed and was itself an O(n) lookup per row). Replace every use of `globalIdx`
in that block with `questionKey(question)`:
- `:725` `expandedQuestions.has(...)`
- `:732` and the `onKeyDown` handler around `:736` — `toggleQuestion(...)`
- `:847-848` — `savedAnswers[...]` and the `setSavedAnswers` update

**Space B — standard list.** In the `filteredQuestions.map` block, replace every
use of the `index` parameter that touches these two state objects with
`questionKey(question)`:
- `:958` `expandedQuestions.has(...)`
- `:966` and the `onKeyDown` handler around `:970` — `toggleQuestion(...)`
- `:1101-1102` — `savedAnswers[...]` and the `setSavedAnswers` update

If `index` is still used for something unrelated (e.g. a displayed question
number), leave that use alone.

**Space C — CSV export.** At `:497-504`, the row number `idx + 1` should stay
as a display number, but the answer lookup must use the key:

```tsx
    const rows = questions.map((q, idx) => [
      idx + 1,
      `"${(q.question || '').replace(/"/g, '""')}"`,
      q.type,
      q.difficulty,
      q.category,
      `"${(savedAnswers[questionKey(q)] || '').replace(/"/g, '""')}"`
    ]);
```

`clearInterviewCache` at `:521-522` resets both state objects to empty and needs
no change (`setSavedAnswers({})` and `setExpandedQuestions(new Set())` are still
valid for the new types).

**Verify**: `npm run type:check` → exit 0, no errors. Then
`grep -n "globalIdx" src/components/sections/InterviewSection.tsx` → **no matches**.

### Step 3: Create the test file

No test file exists for this component. Create
`src/__tests__/InterviewSection.test.tsx`.

For the structural pattern — how this repo mocks `react-i18next`, renders a
section component, and seeds props — model it on an existing section test such
as `src/__tests__/Vision2030Section.test.tsx` (small and close in shape). Read
that file first and follow its mocking setup rather than inventing one.

Write at minimum these three tests, seeding the component with a question set
containing **one vulnerability question and two standard questions** (the
component accepts questions via props and/or localStorage — use whichever path
`Vision2030Section.test.tsx`'s sibling tests demonstrate for this component's
props, and fall back to seeding `localStorage` under the component's
`STORAGE_KEY` if props are not sufficient):

1. **Expansion does not bleed across lists** — expand the vulnerability card,
   assert the first standard card is *not* also expanded.
2. **Answers do not overwrite each other** — type a distinct answer into the
   vulnerability card's textarea and a different one into the first standard
   card's textarea; assert both textareas still hold their own value.
3. **CSV export pairs the right answer with the right question** — after typing
   an answer under one question, assert the exported rows associate that text
   with that question. If asserting on the generated blob proves awkward, it is
   acceptable to assert on `savedAnswers` indirectly via the two textarea values
   instead, and note in a comment why the export assertion was skipped.

Test 2 is the one that documents the actual data-loss bug. If you can only get
one test working, make it that one.

**Verify**: `npx vitest run src/__tests__/InterviewSection.test.tsx` → all pass.

### Step 4: Confirm the tests actually catch the bug

> **Corrected 2026-08-09 after execution.** An earlier version of this step said
> to revert the **vulnerability block only**. That does not reproduce the bug:
> once Step 2 is applied, the standard list already writes a *string* key, and a
> numeric key from a one-sided revert cannot collide with it (`0` vs
> `"Describe a time…"`). The one-sided revert fails only the CSV test, which
> makes the regression test look insensitive when it is not. Do the two-sided
> revert below — it reproduces the actual historical bug.

Temporarily revert **both** `savedAnswers` sites to a raw numeric index at the
same time — the vulnerability block (`:847-848`, back to `globalIdx`) **and**
the standard block (`:1101-1102`, back to `index`). That is the real
pre-fix state and is what collides. Re-run the test file and confirm test 2
**fails** (expect a state-collision timeout, not a clean assertion diff). Then
restore your fix and confirm it passes again.

This step exists because a test that passes both before and after a fix proves
nothing. Do not skip it.

**Verify**: test 2 fails with the bug reintroduced, passes with the fix. Report
both outcomes in your summary.

### Step 5: Full verification

**Verify**:
- `npm run type:check` → exit 0
- `npm run lint` → exit 0
- `npm run test` → exit 0

## Test plan

- **New tests**: 3, in a new file `src/__tests__/InterviewSection.test.tsx`.
  Cases: cross-list expansion isolation; cross-list answer isolation (the
  regression this plan fixes); CSV export answer/question pairing.
- **Structural pattern to follow**: `src/__tests__/Vision2030Section.test.tsx`
  for the mocking and render setup.
- **Fixture shape**: at least one question with a `vulnerabilityType` set and
  two without — the collision does not reproduce with an all-standard set.
- **Mutation check**: Step 4 above — verify the test fails when the bug is
  reintroduced.
- Verification: `npx vitest run src/__tests__/InterviewSection.test.tsx` → all
  pass, then the full suite.

## Done criteria

ALL must hold:

- [ ] `grep -n "globalIdx" src/components/sections/InterviewSection.tsx` → no matches
- [ ] `grep -n "useState<Set<number>>\|useState<Record<number, string>>" src/components/sections/InterviewSection.tsx` → no matches
- [ ] `grep -c "questionKey" src/components/sections/InterviewSection.tsx` → ≥ 7 (definition + 3 index spaces × ≥2 uses)
- [ ] `src/__tests__/InterviewSection.test.tsx` exists with ≥ 3 tests
- [ ] Step 4's mutation check was performed and reported
- [ ] `npm run type:check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts at `:265-266`, `:717-718`, `:952`, or `:497-504` do not match the
  live code — the component has been refactored since this plan was written.
- You find that `question.question` is empty or duplicated within a single
  generated set in a realistic fixture. That would make text an unsafe key and
  the fix needs a different identity strategy (report; do not fall back to
  adding a persisted `id`, for the localStorage reason given above).
- Step 4's mutation check shows the test passing even with the bug
  reintroduced — the test is not exercising the real path.
- Making the tests pass appears to require changing the component's props,
  storage format, or the server response shape.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **What a reviewer should scrutinise**: that *all three* index spaces were
  converted. Space C (the CSV export at `:497-504`) is easy to miss because it
  is 450 lines away from the render blocks and uses its own `idx` name.
- The `questionKey` indirection exists so a future change can swap the identity
  strategy in one place. If a persisted `id` is ever added to `Question`, the
  correct order is: first make the localStorage load path at `:463-473`
  re-normalize through `normalizeQuestion`, *then* change `questionKey` — doing
  it in the other order breaks every cached question set.
- **Deferred out of this plan**: the missing `AbortController`/unmount guard on
  this component's `fetch` at `:361-424` (a tab switch mid-generation can strand
  a paid-for result). It is a separate defect with a separate fix and was left
  out to keep this change reviewable.
- This component has no test file today; the one you create is the seed for
  covering the rest of its 1134 lines later.
