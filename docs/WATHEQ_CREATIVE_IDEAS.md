# Watheq Creative Ideas

Creative backlog parking lot only. Do not treat any item in this document as approved scope until the engineering/security plan permits it.

## Decision Rule

- [ ] No creative feature work should begin before P0 security/privacy risks in `docs/WATHEQ_ENGINEERING_PLAN.md` are addressed.
- [ ] Creative ideas must stay separate from security, privacy, reliability, correctness, and mobile/export stabilization work.
- [ ] Any idea promoted from this parking lot needs a focused product brief, implementation plan, and privacy review before coding.

## ATS Explainability Panel

- [ ] Explain why a score changed using evidence from the resume and job description.
- [ ] Show matched keywords, missing requirements, weak evidence, and caution notes without inventing claims.
- [ ] Keep explanations tied to existing scoring outputs rather than creating a parallel scoring system.

## Before/After Resume Score Diff

- [ ] Compare original match score, projected optimized score, and verified post-application score.
- [ ] Highlight which accepted optimization cards contributed to score movement.
- [ ] Avoid presenting projected gains as guaranteed outcomes.

## Resume Version Timeline

- [ ] Track major resume states such as uploaded, parsed, optimized, applied, exported, and reverted.
- [ ] Let users understand how their resume changed over time.
- [ ] Keep storage and retention implications explicit before implementation.

## Job Description Fit Heatmap

- [ ] Visualize resume coverage against job description requirements by category.
- [ ] Distinguish strong evidence, weak evidence, missing evidence, and unverifiable claims.
- [ ] Preserve the rule that missing skills are recommendations, not auto-injected resume facts.

## Mobile-First Resume Review Mode

- [ ] Provide a compact review flow for small screens focused on scanning, applying, and exporting.
- [ ] Prioritize readable cards, sticky actions, and touch-safe controls.
- [ ] Include Arabic/RTL and PDF/DOCX export behavior in design review.

## AI Response Validation Dashboard

- [ ] Surface schema validation status, dropped fields, fallback behavior, and parse/optimization warnings.
- [ ] Help developers diagnose AI response quality without exposing user PII.
- [ ] Keep this as an internal/admin diagnostic concept unless a user-facing purpose is defined.

## Privacy/Security Audit Mode

- [ ] Show where resume/job data is stored or transmitted during a session.
- [ ] Explain localStorage, Supabase, Redis/Upstash, Sentry, logs, and AI provider boundaries in plain language.
- [ ] Require careful design so the mode improves trust without leaking sensitive details.

## Evidence-Based Cover Letter Generator

- [ ] Generate cover letters that cite only evidence found in the resume and job description.
- [ ] Flag unverifiable or inferred claims before inclusion.
- [ ] Support tone options without weakening truth-preservation rules.

## Career Memory/Profile Intelligence

- [ ] Explore a persistent career profile that remembers user-approved facts across sessions.
- [ ] Require explicit consent, retention controls, export/delete support, and clear boundaries before implementation.
- [ ] Never treat inferred or AI-generated details as verified career facts without user approval.

## Job-Specific Resume Builder

- [ ] Create a guided flow for building a resume variant around a specific job description.
- [ ] Reuse existing parsing, match, optimization, and template systems where possible.
- [ ] Keep each variant grounded in user-approved resume facts and applied-only optimization behavior.

## Parking Lot

- [ ] Add new ideas here only when they are clearly non-P0/P1/P2 engineering stabilization work.
- [ ] Before promoting an idea, define user value, privacy impact, data flow, validation needs, export implications, and verification approach.
