# Coding Standards

> Stack and commands live in `CLAUDE.md` (single source of truth). This file holds repo rules
> and architecture checks only. Package manager is npm; tests are Vitest + happy-dom.

## Repo Rules

- Avoid `any`; define or reuse explicit types, preferably under `src/types/`.
- Use the `@/` alias for imports from `src/`.
- Prefix storage keys with `watheq:`.
- Prefix logs with a component or service name, for example `[ResumeStore]`.
- Error objects should include `status`, `code`, and `message`.
- AI-modified data belongs in `meta.ai_suggestions` unless an established schema says otherwise.
- Resume optimizations only apply when `applied: true`.
- Skills are recommendations only; do not auto-inject them into user resumes.

## Architecture Checks

- Trace changes across UI, service API, Netlify function, validation schema, store, and display before editing.
- Keep frontend PDF/DOCX text extraction in the browser path unless there is a clear reason to change it.
- Keep Supabase server-side calls on `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Do not apply database migrations directly; provide SQL for the user to run.

