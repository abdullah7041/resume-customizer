# Coding Standards

## Stack

- Package manager: npm (`package-lock.json` is present).
- App framework: React 19 with Vite 8 and Tailwind CSS v4.
- State: Zustand with localStorage persistence.
- Backend: Netlify Functions, Supabase, OpenRouter.
- Tests: Vitest with `happy-dom` and Testing Library.

## Commands

- Dev: `npm run dev`
- Netlify dev: `npm run dev:netlify`
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run type:check`
- Test: `npm run test`
- Full quality gate: `npm run quality:parallel`

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

