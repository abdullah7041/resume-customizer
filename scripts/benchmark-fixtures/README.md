# Benchmark Fixtures

## ⚠️ IMPORTANT: Synthetic Data Only

All files in this directory contain **entirely synthetic (fake) data**.

- Names, emails, phone numbers, companies, and job descriptions are fabricated.
- No real person, resume, or job posting has been used.
- Never commit real user resumes or job descriptions to this repository.

## Fixture Files

| File | Scenario | Language |
|------|----------|----------|
| `en-resume-jd.json` | English software engineer + English JD | `en` |
| `ar-resume-jd.json` | Arabic marketing manager + Arabic JD | `ar` |
| `bilingual-resume-jd.json` | Mixed Arabic/English resume + English JD | `mixed` |
| `low-quality-resume-jd.json` | Vague bullets, missing metrics | `en` |
| `saudi-gcc-jd.json` | Saudi/GCC role with local context (NEOM, Vision 2030) | `en` |
| `match-reality-ar-procurement-evidence.json` | Arabic procurement evidence gap for match/reality-check coverage | `ar` |
| `optimize-ar-operations-boundary.json` | Arabic optimization boundary with no invented metrics | `ar` |
| `clarification-*-metrics-smoke.json` | English and Arabic clarification smoke probes | `en`, `ar` |
| `metadata-*-explicit-smoke.json` | English and Arabic job-metadata smoke probes | `en`, `ar` |

## Adding New Fixtures

1. Create a new `.json` file in this directory.
2. Use completely fake names, emails, and companies.
3. Include a stable `id`, `name`, `language`, `resumeText`, `jobDescription`, and `expectedLanguageDirection` where the contract consumes it. Metadata fixtures intentionally contain only `jobDescription`, because the metadata contract accepts job text only.
4. Add `expected.matchScoreBand: [lo, hi]` — the range the optimize contract's
   `match_score` must fall in for this resume/JD pair. `eval:optimize` reports
   violations in its "band" column (anti-inflation guard for the optimize prompt).
   Keep bands generous (~30-35 wide); they catch rubric regressions, not model noise.
5. Verify no real personal data is present before committing.

## Manifest and smoke-only fixtures

`eval/model-eval-fixture-manifest.json` is metadata-only: it references fixture IDs and paths but never repeats resume or job text. Its manifest test freezes the required language and adversarial coverage for every primary decision feature.

Clarification and metadata fixtures are **smoke-only**. They must set
`selectionEligible: false` and `evaluationMode: "smoke_only"`; they do not participate in model winner selection or production-default decisions.
