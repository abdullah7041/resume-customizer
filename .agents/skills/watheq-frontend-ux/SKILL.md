---
name: watheq-frontend-ux
description: Use when changing Watheq React UI, mobile responsiveness, resume display, PDF/export UX, localization, Tailwind styling, onboarding, accessibility, or visual behavior.
---

# Watheq Frontend UX

Use this skill for user-facing React changes, responsive layout, resume rendering, PDF/export experience, localization, onboarding, accessibility, or Tailwind styling.

## Process

1. Read `AGENTS.md`, `CLAUDE.md`, `context/CODING_STANDARDS.md`, and existing nearby components before editing.
2. Follow established React, Vite, Tailwind CSS v4, Zustand, and `@/` import patterns.
3. Preserve resume truth and applied-state behavior; display AI suggestions without silently mutating user-owned resume data.
4. Check Arabic and English workflows, mobile layout, keyboard accessibility, loading states, empty states, and error states when relevant.
5. For PDF/export changes, verify both on-screen resume display and exported output paths.
6. Run focused tests plus the repo quality command after code changes when feasible.

## Output

For diagnosis or plans, state:

- User workflow affected
- Components and state touched
- Responsive, localization, or accessibility considerations
- Verification
