# Bug Fix Protocol

When the user reports a bug, follow this structured approach:

## Phase 1: Investigate Root Cause (BEFORE writing any code)

1. **Read the relevant source files** to understand current behavior
2. **Trace the data flow end-to-end**: frontend → API → backend → DB → response → display
3. **Identify the ROOT CAUSE** — not just the symptom
4. **State your diagnosis** to the user before writing any code

## Phase 2: Implement the Fix

5. **Implement the minimal fix** that addresses the root cause
6. **Run quality checks**: `npm run quality:parallel`
7. **Fix any TypeScript errors, unused variables, or missing imports** immediately

## Phase 3: Verify

8. **Verify the fix addresses the original complaint** by tracing the data flow again
9. **Check for regressions** — ensure no other features were broken
10. **Run the full test suite**: `npm run test`

## Rules

- Do NOT fix surface symptoms — always find the underlying cause
- Do NOT introduce new TypeScript errors or unused variables
- Do NOT skip verification — trace the fix through the full pipeline
- Do NOT assume a backend fix automatically reflects on the frontend
- If the root cause is ambiguous, ask the user for more context (exact error messages, expected vs actual behavior)

## User's bug report:

$ARGUMENTS
