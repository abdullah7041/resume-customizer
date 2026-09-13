# Watheq Optimize and Job Feed implementation

Approved in task conversation. No new dependencies, no publish or database migration application. Ponytail: reuse existing components, adapters, cache and tests. Preserve billing safety, input validation, accessibility and truthful claims.

## 1. Optimize and questions
Trace interruption after answering questions. Preserve original errors, use bounded cache-only recovery and no second paid generation on unknown billing. Add deterministic stream regression cases. Adaptive rounds of 2–3 questions using answer history; stop at resolved gaps, offer explicit continuation after three rounds and Optimize now throughout. Multi-select compatible answers, exclusive no-experience, no inferred defaults. Preserve answers on failures, hash complete input/history. Extend existing contracts and bilingual UI.

## 2. JD extraction
Unify pasted URL and feed description extraction around existing ATS adapters. Add Oracle Candidate Experience, verify supplied /CX/job/9067 URL. Public HTML/JobPosting fallback, typed failures and safety bounds. Measure fixtures and public live examples for Oracle, Workday, Greenhouse, Lever, Ashby, Workable, Pinpoint, LinkedIn and generic JobPosting. Report limitations honestly.

## 3. UI and formatting
Modernize Match Paste here JD input with paste/link modes and status. Standardize action buttons using shared components, including Optimize primary CTA. Preserve work description separately from achievement highlights in parsing, validation, storage, optimization, templates and PDF/DOCX. Regression: Arabic-first AI resume and job-matching SaaS, live in production. is a role description, not an achievement bullet. Never remove arbitrary first bullets. Four templates, English/Arabic.

## 4. Feed recommendations and refresh
Cached AI candidate profile from evidenced work/projects/skills; strong fits and adjacent roles with reasons/gaps. Job requirements reusable independently of candidate, deterministic preferences, no title-only exclusion of adjacent roles. Recommendation relevance distinct from Match score. Refresh caches on CV/preference/JD changes. Crawl completion tracking replaces fixed six-second reload; preserve data on failure, separate queued/completed/partial/failed, true board timestamps and new roles.

## Checks
Focused regression checks first per task; integration lint, frontend/backend types, tests, build, i18n separately. Read-only public probes permitted; do not use credentials or charge AI calls without existing task authorization/budget. Database migrations output for user, never apply. No push or deployment requested.

## Execution ledger
- Worktree: C:/Users/NoteBook Pc/.codex/worktrees/watheq-optimize-feed, branch codex/optimize-import-feed, base e3ade28.
- Existing node_modules shared through a junction; no dependencies added or installed.
- Task 1 in progress: controller. Tasks 2–4 delegated in disjoint scopes. Shared contract/locales changes coordinated.
