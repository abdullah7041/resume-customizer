# Header Controls and Optimize Score Contrast Design

## Goal

Make the Optimize score projection readable in light mode and make theme and language controls directly available from the header at every responsive width, without duplicating either control inside navigation menus.

## Scope

- Update `ScoreDiffBreakdown` presentation classes only; do not change score calculations, copy, or analytics.
- Show theme and language controls in the signed-in desktop header.
- Show compact theme and language controls in the mobile header bar.
- Remove theme and language controls from the signed-in desktop account menu and the mobile navigation panel.
- Preserve signed-out header behavior unless the shared header action layout requires the same direct controls for consistency.
- Preserve English/Arabic switching, RTL layout, dark mode, account-menu portal positioning, credits, authentication, and marketing navigation behavior.

## UI Design

The existing `LanguageSwitcher` remains the single language-changing control. On desktop it sits beside the theme button as a direct header action. On mobile, the same control and a 44-by-44-pixel theme button sit in the compact header action row before the hamburger button. The credits pill may remain fixed in its existing position, but the action row must avoid overlapping it at supported mobile widths.

The desktop account menu keeps account-specific actions only. The mobile navigation panel keeps navigation and account actions only. Neither menu renders theme or language controls.

`ScoreDiffBreakdown` uses explicit light-mode surfaces and semantic foreground colors: dark slate for headings and scores, readable muted slate for explanatory copy, and darker emerald/amber accents. Existing dark-mode colors remain available through `dark:` overrides. Expanded recommendation rows receive the same light/dark surface and foreground treatment.

## Accessibility and Responsive Behavior

- Keep accessible labels for theme, language, open-navigation, and close-navigation controls.
- Preserve at least 44-by-44-pixel touch targets on mobile.
- Keep logical spacing and RTL-aware ordering; do not hard-code left/right positioning for the new controls.
- Ensure each control appears once in the active responsive header and not inside an opened menu.

## Verification

- Add regression tests first for header control placement and menu deduplication.
- Add a regression assertion for explicit light- and dark-mode classes on `ScoreDiffBreakdown`.
- Run the focused Header and ScoreDiff tests, lint touched files, and type-check.
- Perform browser checks in light and dark mode at desktop and mobile widths, including Arabic/RTL.
- Review the final diff, commit it, and push the verified commit to `main` without staging `.claude/settings.local.json`.
