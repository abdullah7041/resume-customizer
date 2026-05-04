---
name: feature-architecture
description: Use before implementing a significant Watheq feature. Ask focused technical questions, identify affected areas, risks, sequence, and verification.
---

# Feature Architecture

Use this skill before significant feature implementation, especially when the change may cross UI, services, validation, Netlify Functions, Supabase, or AI behavior.

## Process

1. Read `AGENTS.md`, `CLAUDE.md`, and `context/CODING_STANDARDS.md`.
2. Clarify the feature goal, user workflow, and success criteria only after repo inspection.
3. Trace affected boundaries: React UI, Zustand store, service API, Netlify function, validation schema, persistence, display, and tests.
4. Identify risks: schema drift, AI score integrity, resume truth preservation, localization, privacy, latency, migrations, and environment variables.
5. Produce a short implementation sequence that starts with the narrowest safe change and names verification commands from `package.json`.

## Output

Keep the result concise:

- Summary
- Impacted areas
- Implementation sequence
- Risks and open questions
- Verification
