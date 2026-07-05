# Goal 5: Job-Specific Resume Builder — ADR only

**Model**: Fable 5, plan mode. No implementation at all.

Architecture decision record only. No code changes beyond creating one file in `docs/adr/`.

Design: Job-Specific Resume Builder for Watheq — a guided flow that builds a resume variant around one job description, reusing the existing parse, match, optimize, and template systems.

Answer in the ADR:

1. Variant data model: how a job-specific variant relates to the base resume in `resumeStore.ts` and Supabase. Fork vs overlay vs applied-cards-replay — pick one with trade-offs.
2. Truth preservation: variants grounded in user-approved facts only; `applied: true` optimization behavior carries over; nothing auto-injected.
3. Storage/retention/privacy: what persists where (localStorage `watheq:` keys, Supabase, Redis 10-min TTL cache), retention policy, export/delete implications. Follow the existing persistence notes in `docs/WATHEQ_ENGINEERING_PLAN.md` section 5.1.
4. Reuse map: which existing endpoints/components are reused as-is, which need parameters, which need nothing.
5. Phased plan: phase 1 must be shippable alone and small. Mark what is deliberately out of scope.
6. Kill criteria: what user signal would justify building phase 1, and what signal kills the idea.

Write it as `docs/adr/ADR-job-specific-resume-builder.md`. Flag every place where the design would force a schema or contract change.

Done when: the ADR exists in `docs/adr/`, zero app code changed. Per the P3 gate in `docs/WATHEQ_ENGINEERING_PLAN.md`, implementation waits for real user signal.
