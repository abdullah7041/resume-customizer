# AGENTS.md

Repository guidance for Codex and other coding agents on Watheq (proprietary Saudi-market AI resume optimizer).

## Read first

- `CLAUDE.md` — stack, commands, hard rules, and the trigger map for on-demand engineering notes. Single source of truth; do not duplicate it here.
- `context/CODING_STANDARDS.md` — repo implementation standards.
- `context/DEVELOPER_PROFILE.md` — collaboration style and product priorities.
- `context/ENGINEERING_NOTES.md` — incident-derived gotchas. Read the relevant section before touching that area (map is in `CLAUDE.md`).

## Operating rules

- Do not add dependencies, external tools, or config changes unless the user explicitly asks.
- Do not change app code during bootstrap or instruction-maintenance tasks.
- Before feature work, diagnose the data flow across frontend, API, validation, and persistence.
- Keep guidance concise. Link to focused context files instead of pasting large blocks.
- DB migrations: output SQL for the user to run in Supabase, never apply directly.

## Tooling

- **rtk** (token-saving CLI proxy): prefer it for reading, searching, checking, and summarizing repo state. Full Windows/PowerShell usage and command list: `.agents/rules/rtk-usage.md`. If rtk is unavailable or unsuitable, use the narrowest normal command and note the fallback.
- **caveman**: `$caveman lite` only for low-risk summaries. Never for security, architecture, or correctness-critical review.
- **Context7 MCP**: current third-party library / framework / SDK / CLI / cloud-service docs when blocked on API details, version behavior, or setup.
- **OpenAI Docs MCP**: OpenAI API / model / SDK / prompting / tool-calling / migration questions. Prefer official docs over memory.

## Tooling checklist

- [ ] Start with repo-local context and focused file reads.
- [ ] Use rtk for compatible searches/checks before normal shell tools.
- [ ] Use Context7 MCP when third-party docs or API behavior are uncertain.
- [ ] Use OpenAI Docs MCP for OpenAI-specific details.
- [ ] Record any fallback or blocked tooling in the final handoff.
