# Export verification and approved Arabic PDF probe — 2026-10-09

## Deployed English exports

The owner reported that Riyadh/Qiddiya PDF/DOCX downloads worked without issues. Brave control recovered on October 9, and the existing authorized session displayed the fictional Nora Example resume. The agent performed fresh Qiddiya PDF/DOCX and Riyadh DOCX downloads through normal visible controls. Browser input/download-event timeouts sometimes occurred after an action had succeeded; actual saved bytes, not the timeout alone, determined the result.

The tested preview was Netlify deploy `6ac7fcb744082b00084214be`, independently confirmed READY with commit `0e8988afbcfbaa5a6dea5b119b7b86d1ca527abd`. [CI 37839602683](https://github.com/abdullah7041/resume-customizer/actions/runs/37839602683), GitGuardian, preview, header and redirect checks passed on that head; Pages changed was neutral. Application code is unchanged from `dd69ae4`. Main remains `211f60fdf42828081e19f99c7e68a2f909c1df85`; [PR #146](https://github.com/abdullah7041/resume-customizer/pull/146) is draft and unmerged. A later report-only commit has its own checks.

Saved bytes were inspected using independent PDF.js 5.7.284 and pypdf checks, plus DOCX ZIP/XML inspection. All listed English files retain both jobs, employer order, work dates, education `2016–2020`, contact details, TypeScript/SQL, the unchanged 20% claim and email/website/GitHub links. PDFs contain no null/replacement characters and are one page. The owner's Riyadh/Qiddiya PDFs were also rendered and visually inspected without obvious clipping or duplicated content.

| File in the owner's Downloads folder | Template | SHA-256 | Result |
| --- | --- | --- | --- |
| `Nora_Example_Software-Engineer (1).pdf` | Qiddiya | `4f71ea0381b95aceba7d63c142d1473e22832ca356846032f08712a639a48899` | PDF text/content/links pass |
| `Nora_Example_Software-Engineer (2).pdf` | Riyadh | `3ee666f1724ee9ee0413df65fe9ae093a3af3d0227ea5e0b7928b2b143dc71ff` | PDF text/content/links pass |
| `Nora_Example_Software-Engineer (3).pdf` | Qiddiya, fresh agent download | `2ae4a11f4f22b2b0145773e665be14f226faccf31c7f870a076c5285e649a18a` | PDF text/content/links pass |
| `Nora_Example_Software-Engineer.docx` | Qiddiya | `d300206ad444894a76906fb8b3d3baa4cb23106631bd127883788c441d93ef08` | Stored content/links pass |
| `Nora_Example_Software-Engineer (1).docx` | Qiddiya, fresh agent download | `e626bcb7a7b0cca82d8448688bf9f365a8adc5a1f0cafb9137b84865d1ebcb6a` | Stored content/links pass |
| `Nora_Example_Software-Engineer (2).docx` | Riyadh, fresh agent download | `7bfbf142344a40e5215d91a2a15e6609018cf6847816382645f369fa70b8de50` | Stored content/links pass |

These exact English download checks supersede the corresponding outstanding-download entries in the October 8 handoff. They do not qualify Arabic PDF, every template/language, DOCX rendering or all ATS systems. Evidence, runnable inspection scripts, extraction sidecars, PDF renders and a preview screenshot are ignored local artifacts under `.superpowers/sdd/2026-10-09-export-checks/`.

## Reader and workflow checks in plain language

- A PDF reader check means opening the PDF, checking its layout, and copying/searching the actual text. The saved-byte text and render checks above cover those English facts independently.
- A Word check means confirming that Word opens the DOCX without repair warnings and displays its text, direction and page breaks correctly. No Codex document session was connected. Word launched and exposed its opening accessibility tree, but an indexed click failed with `coordinate input geometry is unavailable`; fresh window selection/activation and screen capture then failed with `FrameArrived timed out: timed out waiting on channel`. No document was opened by the agent. ZIP/XML success is not Word rendering success.
- Native Print means the app's actual Print action followed by the browser's Save as PDF dialog. The current fixture has no optimization results, so its visible Optimize screen did not expose that export control. No actual native Print output was captured or substituted with a Puppeteer PDF.
- Fresh sign-in means signing in again and checking return to the preview. Existing authenticated exports succeeded; a new OAuth roundtrip was not performed.
- ATS means an employer's recruiting system. No named authorized ATS test account/environment was supplied, so no ATS ingestion result is claimed. Independent text extraction is useful evidence but not a substitute for a named-system import.

## Approved isolated Arabic test

The user explicitly approved one isolated test using existing pdf-lib/fontkit tools and the existing test font, with no new package, production renderer change or deployment. The throwaway test uses the already installed pdf-lib 1.17.1 and isolated @pdf-lib/fontkit 1.1.1 from the prior experiment, plus the same DejaVu Sans bytes (SHA-256 `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954`).

Hypothesis: explicitly label Arabic/Latin runs, shape each with its own direction, preserve glyph positioning, and emit positioned glyph records in original cluster order with the original Unicode mapping. This differs from the rejected stock whole-string `drawText` route. No source string was reversed and no invisible or duplicate text layer was added. Exact source-cluster assertions passed. Explicit fixture runs are not a general Unicode bidirectional algorithm, and the code accesses private embedder internals; it is not a production implementation.

One 8,805-byte PDF was generated: SHA-256 `440934a23593e4afc599b541d80a8203b07df9387a877d35d3f0daf7b657f73f`. Its five original lines cover an Arabic name, sentence, mixed Arabic/`SQL 25% 2024`, lam-alef variants, and `+966500000001`. Acceptance permits whitespace differences only; it does not normalize away missing spaces, changed letters or reordered text.

| Reader | Exact lines recovered | Full source in order | Observed limitation |
| --- | --- | --- | --- |
| PDF.js 5.7.284 | 1/5, phone only | Fail | Arabic spaces disappear; lam-alef text order changes |
| PDFium 5.13.0 | 1/5, phone only | Fail | Arabic word/lam-alef order changes |
| pypdf 6.10.0 | 5/5 | Pass | This reader alone does not establish portability |

PDFium rendering shows connected Arabic, correctly displayed `SQL 25% 2024`, and the phone's leading plus. Normal RTL punctuation and lam-alef group presentation are not marked as visual bugs. Compared with the prior stock route, mixed visual text and pypdf extraction improved. The required cross-reader text gate still fails; do not port this code into the app or claim Arabic PDF solved.

The local `arabic-probe/` directory contains `probe.cjs`, `extract.cjs`, `audit-probe.py`, the unchanged-source manifest, PDF/PNG, ToUnicode CMap and verbatim reader results. Run the generator, then PDF.js extraction, then the bundled-Python auditor. The next engineering work must address word spacing, ligature extraction and reader ordering together, or prove another generator on this fixture before template integration. [Unicode's bidi rules](https://www.unicode.org/reports/tr9/) distinguish logical text from display ordering; [fontkit's API](https://github.com/Hopding/pdf-lib/blob/master/src/types/fontkit.ts) exposes direction and glyph positions, but neither documentation nor this partial result proves a production fix. A new renderer remains an architectural decision requiring its reviewed design and plan.

## What the HR pilot means

It is a real-world usefulness study, separate from software QA. For example, one HR reviewer gets an approved resume and job ad; another gets those same inputs plus the candidate-approved Watheq evidence report. We compare whether they find the right evidence, miss requirements, make corrections and take less time. The existing protocol calls for 12 consenting jobseekers, four consenting HR reviewers and 24 total reviews, split across English, Arabic and mixed cases. No actual participants, invitations or results exist. Recruitment, consent, private handling and sessions cannot be replaced with fictional software tests.
