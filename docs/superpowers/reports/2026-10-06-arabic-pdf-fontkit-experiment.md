# Arabic PDF fontkit experiment — 2026-10-06

**The isolated stock `pdf-lib`/fontkit subset `drawText` route fails the four-line Arabic fidelity gate.** It is a QA result, not a production correction or a claim that every fontkit configuration fails. No application renderer, dependency file, or production code changed.

A single 7,723-byte PDF (SHA-256 `e792d3351050d3843c8fea51dbd385533f1e25d4bcf26dc3720f525529c1c3d5`) was made with bundled `pdf-lib` 1.17.1, isolated `@pdf-lib/fontkit` 1.1.1, `embedFont(..., { subset: true })`, and standard `drawText`. The fontkit package was pinned only in an ignored experiment folder, with lockfile integrity `sha512-KjMd7grNapIWS/Dm0gvfHEilSyAmeLvrEGVcqLGi0VYebuqqzTbgF29efCx7tvx+IEbG3zQciRSWl3GkUSvjZg==` (MIT; transitive `pako` 1.0.11). The existing DejaVu Sans 2.37 TTF was read in place (SHA-256 `7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954`, embedded Bitstream Vera/Arev/DejaVu notices, `fsType=0`). Its equality to an upstream release binary and production redistribution remain unverified.

The untouched source lines were `نورة المثال`, `أعددت تقارير داخلية دون قياس للنتيجة.`, `نورة المثال SQL 25% 2024`, and `لا لأ لإ لآ`. Exact full-line extraction from the **same bytes**, allowing only line/edge whitespace, produced:

| Reader | Name | Bullet | Mixed | Lam-alef |
| --- | --- | --- | --- | --- |
| PDFjs 5.7.284 | pass | pass | fail: `نورة المثال LQS %52 4202` | fail: `ال أل إل آل` |
| PDFium 5.13.0 | fail: `المثال نورة` | fail: reversed word order | fail: `4202 %52 LQS المثال نورة` | fail: `آل إل أل ال` |
| pypdf 6.10.0 | pass | pass | fail: `نورة المثال` only | pass |

Fontkit layout retained contextual Arabic glyphs and original code points. The actual `/ToUnicode` CMap contains two-codepoint sequences for all four lam-alef glyphs; its presence did not make the readers agree on order. The PDFium PNG shows connected Arabic for the name and sentence, while the mixed text visibly renders `4202 %52 LQS` instead of `SQL 25% 2024`. The period at the left of the Arabic sentence and the physical group order of lam-alef forms are normal RTL presentation, not visual defects.

The ignored QA folder `.superpowers/sdd/2026-10-06-remaining-validation/fontkit-probe/` holds the PDF, PNG, layout, CMap, exact comparison JSON, package lock, and runnable scripts. Its adjacent `task-2-report.md` has full receipts and the independent review is `task-2-review.md`. The route stops at this failure; no template port or deployment test was attempted. Arabic PDF text fidelity, real-reader copy/search, and Netlify Linux execution remain open gates.
