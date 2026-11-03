# Resume selection and upload repair — 2026-11-03

## Cause and changes

The screenshot's two saved resumes had no active selection. `ResumeSelector` returned nothing in that state, while the saved-resume manager exposed only rename and remove. The selector now works without an active resume, the manager opens automatically in that case, and every saved card has an explicit Use resume action connected to the existing workspace activation path.

Choosing or dropping files now starts processing automatically. Pasted text retains an explicit preparation action. Batch processing remains sequential and retains the active resume, job description, and analysis; with no active resume, the user explicitly selects a saved result. There is one terminal notification. Cancellation, per-file errors, file formats, the 5 MB limit, and the five-resume capacity remain covered.

The card is more compact, paste is expandable, saved cards show filename/candidate/title and a clear active state, and progress has two labeled stages: Read file and Prepare resume. Full-library rejection leaves an inline explanation and a retry action after space is made.

The parsing client previously extracted the same file again on every network retry. It now retains that request's prepared payload. A complete matching parse in the existing device library can also be reused without another AI request; failed or incomplete parses are excluded. Readability checks and backend parsing contracts remain intact. New files still require AI preparation; no claim of a measured live latency improvement is made.

## Verification

- Failing-first tests reproduced the missing selector with a null active ID, absent library activation, repeated extraction, and failure to reuse saved parsed content.
- 49 focused selection/upload/API/library tests passed. After the final UI additions, 39 upload tests passed, including automatic picker/drop processing, the two progress stages, cancellation, partial batch failures, unchanged active work, capacity recovery, and single terminal notifications. These runs overlap.
- 117 workspace and optimization API regression tests passed. Separately, all 17 light-mode contrast guards passed.
- Type checking, repository lint, production build, translations, and `git diff --check` passed. Build output retains existing chunk-size and ineffective dynamic-import warnings.
- Independent review found no important actionable issues. No dependencies, backend models, database schema, or tool configuration changed.

## Verification boundary

The browser tool reported `Local browser use is disabled in Work settings`, including after the user indicated they would enable it. Live browser selection, appearance in light/dark and Arabic, real PDF timing, and a new screenshot were therefore not verified in this run. Automated tests and a published build do not substitute for those observations.

Tooling: CodeGraph was used first; stale or omitted source required narrow direct reads. `RTK.md` remains absent. React Doctor is not installed locally; no tools were installed under the repository's no-install rule.
