# Watheq UI Foundation

Watheq uses shadcn/ui as the base component foundation for new shared UI. This is a controlled foundation layer, not a full migration of the existing product interface.

## Shared Components

- shadcn/ui components live in `src/components/ui/shadcn/`.
- Existing Watheq custom primitives remain in `src/components/ui/`, including `GlassButton`, `GlassCard`, `GlassTabs`, `GlassInput`, `GlassTextarea`, and `Toast`.
- `src/components/ui/Tooltip.tsx` preserves the legacy wrapper API while composing the shadcn tooltip primitives.
- New shared UI should use the shadcn components when practical.
- Old UI is migrated only when that surface is already being touched for product work.
- Do not duplicate `cn`; generated components must import it from `@/lib/utils/cn`.

## Adding Components

Use the repo package manager and shadcn CLI:

```bash
npx shadcn@latest add <component>
```

Keep added components under `src/components/ui/shadcn/`. Do not add broad component sets or registry blocks unless the current task needs them.

## Toasts

Watheq currently uses `src/components/ui/Toast.tsx`. Do not add `sonner` during foundation-only work. Revisit sonner only when a real toast migration is scoped and tested.

## Copy And i18n

- Do not hardcode new user-facing English or Arabic copy.
- Use existing translation keys for visible runtime text.
- When using shadcn dialogs, pass localized labels for optional close controls.
- Dev-only examples and documentation may use English text.
- Do not change the i18n architecture during UI component work.

## RTL Review Checklist

Before migrating a user-facing surface to shadcn components, review:

- Button icon placement and loading alignment in English and Arabic.
- Dialog title, close button, footer action order, and focus behavior.
- Select trigger, dropdown alignment, item text direction, and keyboard navigation.
- Tabs trigger order, active indicator direction, and scroll behavior.
- Form label, description, error, and input spacing in RTL.
- Avoid physical `left` and `right` spacing when logical direction-aware classes or CSS properties fit the job.

Current generated shadcn primitives include a few physical alignment classes, especially in dialog centering, select item indicators, and tab line indicators. Treat those as review points during the first real Arabic-facing migration rather than as a reason to refactor major flows now.

## Current Overlap

The existing Watheq glass primitives overlap with shadcn `Button`, `Card`, `Tabs`, `Input`, `Textarea`, and future toast choices. Keep both layers until a narrow migration task replaces one touched surface at a time.
