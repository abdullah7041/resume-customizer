# AGENTS.md

Repository guidance for Codex and other coding agents working on Watheq.

## Project Snapshot

Watheq is a proprietary Saudi-market AI resume optimizer. The app uses React 19, Vite 8, Tailwind CSS v4, Zustand, Vitest, Netlify Functions, Supabase, and OpenRouter.

## Read First

- `CLAUDE.md` is the single source of truth — project rules, commands, gotchas, standards, and key file locations. Preserve those rules unless a user explicitly changes them.
- `rtk init -g --codex` configures Codex to use `rtk` for compatible shell executables to reduce noisy output.

## Operating Rules

- Do not add dependencies unless the user explicitly asks.
- Do not change app code during repository bootstrap or instruction-maintenance tasks.
- Before feature work, diagnose the data flow and identify impacted frontend, API, validation, and persistence boundaries.
- Keep generated guidance concise. Link to focused context files instead of pasting large persona or process blocks into this file.
- Prefer npm scripts already defined in `package.json`. Match verification to the change, do not run the broad gate by reflex: docs/copy → `git diff --check`; single component → relevant Vitest file(s) + lint on touched files; shared runtime/schemas/contracts/stores/Netlify functions → focused tests + `npm run type:check`; handoff/cross-cutting → broad gate; launch/release needing build + i18n → `npm run quality:full`.
- Running the broad gate in-agent: do NOT call `quality:parallel` as one shot — its all-or-nothing parallel bundle overruns the wall-clock cap and discards partial results. Run `npm run lint`, `npm run type:check`, `npm run test` as separate sequential commands (add `-- --changed` to scope tests to files touched since git HEAD). Reserve `npm run quality:parallel` for the dev machine / CI. Never re-run a timed-out broad gate blindly — report it inconclusive and list which focused checks passed.
- Database migrations should be output for the user to run in Supabase, not applied directly by an agent.
- Keep repo workflow guidance in this file rather than creating broad workflow skills.
- Use focused skills in `.agents/skills/` only for scoped jobs such as feature architecture, AI resume pipeline changes, backend boundaries, or frontend UX work.

## Tooling Rules

- When `.codegraph/` exists, use CodeGraph first for code discovery, architecture/data-flow tracing, symbol lookup, callers/callees, and change-impact analysis. Prefer the `codegraph_explore` MCP tool after restarting the agent; use `codegraph explore "<question or symbols>"` as the shell fallback. Use direct file reads to verify live content when CodeGraph reports pending/stale files.
- Prefer `rtk` for compatible shell executables when reading, searching, checking, or summarizing repository state, especially when it reduces noisy output. If `rtk` is unavailable or unsuitable for the command, use the narrowest normal shell command and note the fallback.
- Optional: use `$caveman lite` only for low-risk summaries. Never use it for security, architecture, or correctness-critical reviews.
- Use Context7 MCP for current third-party library, framework, SDK, CLI, and cloud-service documentation when implementation is blocked by API details, version behavior, setup/configuration uncertainty, or stale local knowledge. Use the configured Context7 MCP tools; the source project is `https://github.com/upstash/context7.git`.
- Use OpenAI Docs MCP for OpenAI API, model, SDK, prompting, tool-calling, or migration questions. Prefer official OpenAI documentation sources and avoid relying on memory for current OpenAI product behavior.
- Do not install packages, add external tools, or change tool configuration unless the user explicitly approves it.

### RTK on Windows / PowerShell

- Prefer explicit RTK commands only when they exist: `rtk git status`, `rtk git diff --stat`, `rtk git diff`, `rtk read <file>`, `rtk rg "<pattern>" <path>`, `rtk find "<glob>" <path>`, `rtk test <command>`, `rtk lint`, and `rtk tsc`.
- Do not run PowerShell cmdlets as RTK subcommands. Wrong: `rtk Get-Content AGENTS.md`. Right: `rtk read AGENTS.md`.
- On native Windows, prefer `rtk rg`; `rtk grep` requires an external `grep` binary and will fail when only ripgrep (`rg`) is installed.
- Avoid running multiple `rtk read` or `rtk rg` commands in parallel under short tool timeouts. Run them sequentially, or give RTK calls about 30 seconds when parallelism is necessary; if RTK still hangs, use a narrow PowerShell fallback and report it.
- If PowerShell syntax or cmdlets are required, wrap them with `rtk proxy`, for example `rtk proxy powershell -NoProfile -Command "Get-Content -Raw -LiteralPath 'AGENTS.md'"` or `rtk proxy powershell -NoProfile -Command "Test-Path -LiteralPath './src'"`.
- If RTK search hits access-denied errors, first verify the working directory, then restrict the search to repo paths such as `src`, `netlify`, `docs`, `supabase`, and `.agents`.
- If RTK output is insufficient, use a narrow non-RTK fallback and explicitly explain why.

### Tooling Checklist

- [ ] Start with repo-local context and focused file reads.
- [ ] Use CodeGraph first for structural code discovery and impact analysis when the repository is indexed.
- [ ] Use `rtk` for compatible searches/checks before falling back to normal shell tools.
- [ ] Use Context7 MCP when third-party docs or API behavior are uncertain.
- [ ] Use OpenAI Docs MCP for OpenAI-specific implementation details.
- [ ] Record any fallback or blocked tooling in the final handoff.
