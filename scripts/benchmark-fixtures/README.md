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

## Adding New Fixtures

1. Create a new `.json` file in this directory.
2. Use completely fake names, emails, and companies.
3. Include `name`, `language`, `resumeText`, `jobDescription`, and `expectedLanguageDirection`.
4. Verify no real personal data is present before committing.
