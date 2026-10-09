# Watheq owner handoff — 2026-10-08

Updated 2026-10-10: a new plain-layout prototype now preserves all five original fixtures across three readers; production Arabic PDF is still unqualified. See the [new feasibility result and proposed integration](2026-10-10-arabic-pdf-feasibility.md). The owner selected a [personal recruiter walkthrough](../../hr-pilot/owner-test.md); the formal HR study below is deferred, with no participant results.

Updated 2026-10-09: the owner's Riyadh/Qiddiya English PDFs and fresh deployed PDF/DOCX bytes were independently inspected. These download/content checks are complete for the listed files. The approved Arabic positioned-run prototype still fails two readers. See the [current verification and probe results](2026-10-09-export-verification-and-arabic-probe.md) before using the remaining checklist below.

## Current result

The candidate-first implementation and evidenced English export fixes are on [draft PR #146](https://github.com/abdullah7041/resume-customizer/pull/146). Application code SHA: `dd69ae438e69157ec00e037c3e3c7bfe69a58b72`. [CI 37763164945](https://github.com/abdullah7041/resume-customizer/actions/runs/37763164945), GitGuardian, Netlify preview, header and redirect checks passed on that SHA. Pages changed was neutral. Netlify deploy `6ac76f273e8be80008c30b85` serves the [PR preview](https://deploy-preview-146--resume-optimizing.netlify.app). Main remains `211f60fdf42828081e19f99c7e68a2f909c1df85`; no merge, production release or participant contact occurred. A later documentation commit has its own PR checks.

Fresh local verification for this handoff:

- Production build and translation validation passed. The build retained nonblocking warnings about browser externalization of `node:zlib`, an invalid generated CSS token, and the existing mixed static/dynamic OnboardingChat import; these were not changed by the export fixes.
- The existing candidate-trust harness was reused in ignored QA files and extended locally to Neom: 9 tests passed, including real Edge production-handler generation of seven PDFs. Local auth/rate limiting were mocked; this is not signed-in hosted delivery.
- All four English template PDFs passed PDF.js and independent pypdf checks for core contact facts, job attribution, dates, URLs and source achievements. Their one-page renders were inspected. The long mixed example has four pages; all 45 numbered details survived in order. Arabic/mixed logical PDF text still fails and is held unverified.
- Regenerated 16 DOCX files and six candidate evidence reports with the production exporters. Independent Python ZIP/XML/JSON inspection verified saved hashes, core fields, employer/highlight association, hyperlinks, input/source fingerprints and clarification opt-in/exclusion. DOCX XML is not a Word or ATS rendering result.
- The pilot calculator's fictional assertions passed; the blank template correctly reports insufficient evidence with zero participant cases.

Evidence and samples are local under `.superpowers/sdd/2026-10-08-owner-handoff/`; `inspection.json` records actual file hashes and limits. The owner ZIP contains the samples, inputs, expected JSON, inspection results and a blank manual-results CSV. It contains fictional data only and is not committed to Git.

## Start with these owner checks

1. Open the PR preview and refresh it. Use `inputs/english.txt` from the ZIP. Compare the prepared resume against `inputs/english.expected.json`; there should be exactly two jobs, with Cedar Labs before Harbor Works and the supplied 20% achievement unchanged. Correct or report a parse discrepancy before export.
2. Export **Riyadh and Qiddiya** as PDF and DOCX. Save with distinct names such as `deployed-english-qiddiya.pdf`. Then re-export Khobar to confirm its date fix; Neom completes English template coverage. Record the date, template, browser/reader, filename, app text-check state and result in `manual-results.csv`. This establishes hosted delivery; the ZIP's local samples do not.
3. Open each actual PDF in a normal PDF reader. Check layout, both jobs, the work dates `2022-01–2024-06` and `2020-01–2021-12`, the unchanged `20%`, email/website/GitHub links, and no clipped/duplicated content. Riyadh, Khobar and Qiddiya must show education `2016–2020`; Neom currently displays the end year `2020` only. Uppercase names are intentional in Qiddiya/Neom.
4. Select all PDF text and copy it into a plain-text editor. Search for the name and a complete achievement sentence. Confirm usable word order, numbers and punctuation without null/replacement characters. Visual readability alone is not a pass. Provide the files or exact local paths for independent byte inspection if a result is unclear.
5. Open the DOCX samples in Word or LibreOffice, starting with English Qiddiya and Arabic/mixed Riyadh. Check readable shaping/direction, intact facts, links, page breaks and no repair warning; repeat with the actual deployed DOCX files. Then expand to the other templates/long-content samples for full format coverage.
6. Use the app's actual **Print** action and the browser's **Save as PDF** dialog. Repeat content, URLs and copy/search checks for English, Arabic, mixed and multipage input. A successful print dialog is not content validation. A local Puppeteer PDF does not establish this native route.
7. In a separate browser window, perform a fresh sign-in to the preview with your authorized test account. Confirm it returns to the preview rather than localhost. Existing signed-in access did not establish a new OAuth roundtrip. Record only the outcome and a URL without authentication tokens if it fails.
8. If you have an authorized ATS test environment, import fictional exports and compare the parsed fields against the expected inputs. Record the named ATS/version and errors. A pass applies to that tested system, not every ATS; do not submit a live job application as a test.

Use `inputs/arabic.txt`, `mixed.txt`, and `multipage.txt` for language/page coverage. Plain-text paste is a convenient functional test; the associated expected JSON identifies the intended facts. The parser may require candidate correction on ambiguous input. Exact original-source fidelity is checked against those facts, not by assuming parsing was perfect.

## Known limits and work ownership

| Item | Current state | Next owner |
| --- | --- | --- |
| Signed-in hosted files and fresh OAuth roundtrip | Manual verification outstanding; Brave automation failed request-header policy before listing tabs | Owner performs browser checks and returns files/results |
| Word/LibreOffice interaction | Word is installed; native screen capture timed out on the initial attempt and one recovery before any sample opened | Owner opens the supplied/deployed DOCX files |
| Arabic/mixed logical PDF text | Known failure; reader verification cannot repair it | Engineering follow-up if qualified Arabic PDF is required |
| DOCX display projections | Neom omits education start year in four cases; skill categories omitted in 12/16 files; country code omitted in 16/16, while city and core fields remain | Owner considers the chosen delivery format; these are recorded projections, not full source-field preservation |
| ATS ingestion | No named-system result | Owner with authorized ATS test access |
| Main integration/release | PR remains draft and unmerged | Owner makes the merge/release decision separately from pilot completion |

No new renderer experiment was run. Previously rejected font/bidi/pdf-lib routes must not be repeated unchanged. A new renderer approach requires a specific feasibility hypothesis and a reviewed design before production replacement. Exact logical text and connected visual shaping must pass from the same bytes across independent readers. Do not reverse source strings or add invisible/duplicate text to manufacture a pass. The failure is engineering work, not a task the owner can close by approving a screenshot.

The near-term pilot can use an actually inspected DOCX/evidence report while Arabic PDF remains explicitly unverified. This does not close the PDF gate. Full participant validation is separate from deciding whether to integrate the candidate-first code with documented limitations.

## Owner-run pilot

The selected protocol is 12 adult volunteer candidates (four English, four Arabic, four mixed), four active HR reviewers and 24 paired reviews. Preparation exists; actual recruitment, consent and sessions do not.

Before collection, fill this privately:

```text
Facilitator: [actual name]
Withdrawal contact: [actual contact route]
Candidate roster: [12 IDs with contacts in a private roster]
Reviewer roster: [4 IDs, contacts, language and role familiarity]
Invitation channel: [authorized individual channel]
Private storage: [actual location, access, sync/backups checked]
Deletion: 30 days after the final session; immediate withdrawal removal
```

Use the prepared invitations/consent wording. Invitation acceptance does not authorize sharing a resume. Keep identities/consents separate from pseudonymous case records and outside Git. Before sharing, obtain consent, candidate approval of exact packet bytes and included clarifications, complete requirement/claim audits and two independent reference annotations, and lock actual dates and balanced reviewer allocation. Conduct the 24 reviews and record actual timing, judgments, corrections, missingness and withdrawals. The protocol and session prompts in the ZIP contain the details; use no fictional lock dates or attestations as participant evidence.

Run the existing calculator only after records are audited. A blank/simulated study cannot pass empirical readiness. Return anonymized results for analysis; keep contact lists, raw resumes and consent records private.

## Handoff boundaries

No dependency, font, hosted auth setting, billing, migration or participant-data collection was introduced. The pre-existing untracked `docs/superpowers/plans/2026-10-06-new-chat-handoff.md` was preserved. This isolated checkout has no CodeGraph index; scoped RTK, direct reads and QA-only scripts were used. Native Word capture and the signed-in browser are the specific tool gaps; local export generation and saved-byte inspection are complete within the scope above.
