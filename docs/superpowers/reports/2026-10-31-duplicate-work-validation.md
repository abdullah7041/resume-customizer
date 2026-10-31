# Duplicate work-entry repair — 2026-10-31

## Reproduction and cause

The live template preview contained three complete roles followed by three malformed recovery copies. In those copies, the employer became `position`, the city became `name`, dates were empty, and the highlights repeated the complete jobs with physical line fragments. This made each of the four optimization source texts match multiple jobs, so the merge safeguard correctly refused them.

A failing-first recovery test reproduced three complete jobs expanding to six when the physical input placed the role and employer/location on separate lines. The separator in `Watheq | Riyadh, Saudi Arabia` was treated as a new role/company header. Recovery compared that malformed position with the complete role and appended it as missing. Comparison also conflated the same title at different employers and failed across internal PDF spacing differences.

Separately, the store deduplicated work by employer name, losing distinct roles or employment periods. The native editor updated the open resume but did not persist corrections to its library entry.

## Changes

- Keep a recognized standalone role and its following employer/location line together. Preserve independent role/company headers and dates, including missing-employer cases and parenthesized locations.
- Compare employer identity as well as position during recovery, with whitespace normalization for comparison only.
- Deduplicate only equivalent complete work content, ignoring property order and empty defaults. Preserve distinct roles, dates, and bullets; repeated onboarding patches remain idempotent.
- Persist editor corrections through the existing library save before updating the open resume. Disable editing and closing while storage is pending; retain the draft and show an inline error if saving fails.
- Preserve the ambiguous-target merge safeguard. Existing saved data is repaired explicitly through the editor; no bulk migration or new dependency was added.

## Verification

- 187 focused parser, recovery, store, editor, and utility tests passed after review corrections.
- 156 additional merge, evidence, work-description, template, and library boundary tests passed.
- A subsequent 75-test store/utility run passed after adding the empty-default idempotency regression. These tests overlap the focused run; counts are not additive.
- A local check using the six work records from the actual browser preview and the four exact returned edits reproduced four merge failures before repair, then zero failures and four included edits after retaining the complete roles. The private input and one-off harness are kept outside the repository.
- Type checking, repository lint, final touched-file lint, production build, translation validation, and `git diff --check` passed. Build warnings remain the existing chunk-size and ineffective dynamic-import notices.
- Independent code review approved the final implementation after verifying separate-role preservation, whitespace identity, pending-save controls, and default-insensitive deduplication.

Tooling: `RTK.md` is absent. CodeGraph's stale/omitted source required narrow direct reads; RTK line-range reads were unsupported, so those used PowerShell. React Doctor is not installed locally; the repository prohibits installing tools without explicit approval, so no package was fetched. React changes received lint, types, focused tests, and independent review instead.

## Live repair

- Main commit `6f67d3413ab5245abbc51c5efa44dd0f457adff0` was published in Netlify deploy `6ae5dcbcfb95dca8ef8fb30d` at `2026-10-31T12:20:38.409Z`.
- Reloaded the existing signed-in Brave tab, opened the native editor, and explicitly removed the three malformed recovery copies. Saved successfully through the new library persistence path.
- A comparison of the complete rendered previews confirmed six jobs became three, all three complete jobs remained text-identical, and every other resume section remained text-identical. The complete pre-repair preview is backed up locally as `watheq-resume-before-duplicate-repair.html`; the original PDF is retained.
- Reloaded again and reopened Experience: the three complete roles and their original employment dates remained. No duplicate employer-as-position rows returned.
- The existing four edits passed the local merge qualification against this corrected content. Saving the baseline correctly invalidated the previous assessments in the live app, so a new live score-preview calculation was not claimed. No additional optimization was requested or credits used; the browser balance remained 11/20.
