---
name: watheq-ai-resume-pipeline
description: Use when changing Watheq resume parsing, matching, optimization, ATS scoring, AI prompts, OpenRouter calls, schema validation, or AI response handling.
---

# Watheq AI Resume Pipeline

Use this skill for changes that affect resume extraction, match analysis, optimization, scoring, cover letters, interview questions, AI schemas, or OpenRouter behavior.

## Process

1. Read `AGENTS.md`, `CLAUDE.md`, `context/CODING_STANDARDS.md`, and `references/ai-data-flow.md`.
2. Trace the complete data path before editing: browser extraction, `src/services/api.js`, Netlify function, shared validation, AI client, response shaping, store, and display.
3. Preserve resume truth: do not invent facts, inflate scores, auto-inject skills, or apply suggestions unless the established `applied: true` flow says so.
4. Keep AI-modified data in `meta.ai_suggestions` unless an existing schema requires a different location.
5. Keep prompts and schemas aligned; update tests around parsing, scoring, optimization, and response handling when behavior changes.
6. Run the repo quality command after code changes when feasible.

## Output

For diagnosis or plans, state:

- Root cause or intended behavior
- Data flow touched
- Schema or prompt impact
- Verification
