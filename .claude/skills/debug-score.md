# Debug Score Issue

**Purpose**: Enforce root cause analysis for scoring bugs before implementing fixes.

## When to Use

- Match scores displaying incorrectly
- AI-generated scores seem wrong or random
- Score inconsistencies after resume re-upload
- Score persistence issues
- Any bug related to score calculation or display

## Protocol (MANDATORY)

### Step 1: Understand Expected Behavior
Ask the user to confirm:
1. **Expected score**: What should the score be?
2. **Actual score**: What is currently displayed?
3. **Repro steps**: Exact steps to reproduce the bug

### Step 2: Trace Complete Data Flow

Before writing ANY code, map the ENTIRE pipeline:

```
┌─────────────────┐
│ 1. AI Service   │ → Where score originates (OpenRouter/Gemini)
│    Response     │    Log the raw response
└────────┬────────┘
         │
┌────────▼────────┐
│ 2. API Function │ → netlify/functions/*.ts
│    Processing   │    Check transformations, parsing
└────────┬────────┘
         │
┌────────▼────────┐
│ 3. State Store  │ → resumeStore.ts / CreditsContext
│    Management   │    Check caching, persistence
└────────┬────────┘
         │
┌────────▼────────┐
│ 4. Component    │ → React component state
│    State        │    Check hooks, local state
└────────┬────────┘
         │
┌────────▼────────┐
│ 5. UI Render    │ → What user sees
│    Display      │    Check display logic, formatting
└─────────────────┘
```

**For EACH stage, log:**
- Input value
- Any transformations applied
- Output value
- Where value is stored/cached

### Step 3: Identify Root Cause

Common scoring bug patterns (historical data):
- ✗ AI service returning wrong values (check prompt)
- ✗ Score cached with wrong fingerprint key
- ✗ Toggle state showing wrong resume version
- ✗ Fuzzy merge applying wrong optimizations
- ✗ Display logic showing stale/cached value

**Question to answer**: At which stage does the value become incorrect?

### Step 4: Verify Understanding

Before implementing ANY fix:
1. Explain the root cause to the user
2. Show where in the pipeline the bug originates
3. Propose the minimal fix that addresses the ROOT CAUSE
4. Get user confirmation

### Step 5: Implement + Test

1. Write a failing test that captures expected vs actual behavior:
```typescript
test('score should be 95 after uploading optimized resume', () => {
  const result = analyzeResume(optimizedResume, jobDescription);
  expect(result.matchScore).toBe(95); // Not 75!
});
```

2. Implement the fix at the ROOT CAUSE location (not the symptom)

3. Run quality checks:
```bash
npm run quality:parallel
```

4. Verify the test now passes

## Anti-Patterns (DO NOT DO THIS)

❌ **Surface-level fixes**: Fixing display without checking calculation
❌ **Assumption-based debugging**: Guessing without tracing data flow
❌ **Quick patches**: Adding persistence without fixing underlying logic
❌ **Skipping tests**: Not writing a test that would catch this bug

## Business Logic Rules (This Codebase)

- ✅ Scores MUST be genuine calculations, never random/placeholder values
- ✅ AI scoring should reflect actual resume-job matching analysis
- ✅ Scores should persist correctly across resume re-uploads
- ✅ Cache keys must account for resume version (original vs optimized)

## Files to Check (Common Locations)

**AI Scoring**:
- `netlify/functions/ai-match.ts` - TF-IDF matching
- `netlify/functions/optimize.ts` - Optimization scoring
- `netlify/lib/openrouter-client.js` - AI API calls

**State Management**:
- `src/lib/stores/resumeStore.ts` - Score caching, fingerprinting
- `src/contexts/CreditsContext.tsx` - Credit state management

**UI Components**:
- `src/components/sections/MatchSection.tsx` - Match score display
- `src/components/sections/OptimizeSection.tsx` - Optimization scores

## Success Criteria

- ✅ Root cause identified and explained
- ✅ Failing test written capturing expected behavior
- ✅ Fix implemented at ROOT CAUSE (not symptom)
- ✅ Test passes after fix
- ✅ Quality checks pass (`quality:parallel`)
- ✅ User confirms score is now "genuine not random"
