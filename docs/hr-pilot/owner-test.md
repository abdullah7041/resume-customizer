# Test Watheq as a recruiter yourself

The owner selected a personal walkthrough because HR contacts are not currently available. Use it to find mistakes and assess usefulness. It is not an independent HR study, and it does not establish hiring accuracy or general recruiter time savings. No HR contacts or participant recruitment are needed.

## Prepare one case

Use your own resume or a fictional resume, plus one complete job description. Keep the same resume and job description for both reviews. Start with one English case, then an Arabic case and a mixed-language case. Use roles you understand; mark a requirement unclear when you cannot judge it.

Before opening Watheq's assessment, copy five explicit job requirements into the table below. For each requirement, decide what evidence would count. For example, a fictional work bullet saying “built SQL reports” supports SQL reporting experience; “SQL” appearing only in a skills list does not demonstrate that work. Do not add a requirement that the job description never asks for.

These are fictional examples of how to judge a requirement:

| Requirement in the example job ad | Text in the example resume | Your judgment |
| --- | --- | --- |
| SQL reporting experience | “Built monthly SQL reports for the operations team.” | Supported by the supplied work example; no independent verification is implied. |
| SQL reporting experience | “Skills: SQL” | Partial: SQL is listed, but a reporting work example is missing. |
| Managed a team of five | No team size or management experience supplied | Not evidenced; ask for evidence rather than inventing a team. |

`Unclear` means the wording or context is too ambiguous to judge. `Not evidenced` means the supplied material does not support the requirement; it does not prove the candidate lacks the ability.

## Review twice

1. **Resume alone:** Start a timer. Read the resume and job description without Watheq's score or report. Fill the Baseline column with `supported`, `partial`, `not evidenced` or `unclear`, plus the exact supporting quote or missing fact. Stop the timer when all five rows are filled.
2. **Candidate review:** In Watheq, use those same inputs. Check proposed changes against the original resume. Correct unsupported statements, preserve dates and numbers, and approve only changes you can substantiate. Include a clarification in the evidence report only if you intend to share it. Do not silently change the resume between the two reviews; a changed resume needs a new case.
3. **Resume plus report:** Prepare and review the report using the controls below. Restart the timer and review the same five requirements with the resume, job description and report. Keep alignment scores hidden while judging evidence. Fill the With report column and record every changed judgment and its reason.
4. **Challenge the report:** Check whether each quote really supports its associated requirement. Look for facts attached to the wrong employer, dates or numbers changed, skills-list claims treated as demonstrated work, missing requirements presented as strengths, and private clarifications included without selection. Record misleading implications even when the quoted words are accurate.
5. **Check delivery:** Open the exported resume/report and compare the five rows against the exact input. Record the format, template and language. Arabic PDF text fidelity remains under engineering investigation; visual approval alone does not close that defect.

Do not use a shorter second-review time as proof that the report is faster: you already know the case. For later cases, alternate which condition you inspect first and record the order, but the same person's judgments still are not an independent comparison.

## Where to find the report

After an Optimize assessment, expand **Candidate evidence report**. Click **Add requirement** for each of your five exact job-ad quotes. For each row, choose a relevant **Candidate-associated source** and check its **Exact source quote** against the original resume. Leave **No evidence selected — gap** when you have no support. Private answers stay excluded unless you select them.

Click **Prepare report for review**. Read the preview, especially the `requirements` entries and their evidence quotes. The report is currently JSON, so braces and field names are expected. `candidate_associated` means you selected a source; it does not mean Watheq verified that the candidate meets the requirement. `gap` means no evidence was selected; `invalid_selection` needs correction. An outdated/historical assessment cannot supply current evidence; return to the same inputs and obtain a current assessment before testing that condition.

Then click **Download reviewed report** to save `watheq-candidate-evidence.json`. You may use the on-screen preview for your comparison. Changing inputs or inclusion choices requires preparing and reviewing a new report. Keep the original resume beside it throughout your recruiter review.

## Worksheet

Copy this worksheet for each case. Keep filled worksheets outside Git if they contain personal information.

- Case ID / language:
- Resume version / job-description version:
- Exported report version / resume template and format:
- Review order: baseline first / report first
- Baseline seconds / report seconds:

| Exact job requirement | Evidence that would count | Baseline: label and quote/gap | With report: label and quote/gap | Changed judgment and reason |
| --- | --- | --- | --- | --- |
| 1. | | | | |
| 2. | | | | |
| 3. | | | | |
| 4. | | | | |
| 5. | | | | |

| Issue | Exact original text | What Watheq displayed/exported | Expected correction |
| --- | --- | --- | --- |
| | | | |

Finish each case with: “The report helped me ___; confused me about ___; I would need ___ before using it for a screening decision.” Record negative findings as well as helpful ones. Any invented fact, changed factual claim, misleading evidence association or unexpected private disclosure is a defect to fix, not a successful case.

## What to send back

Send the case ID, language, template/format, failed requirement row, exact original and generated wording, and the action that produced it. A fictional or redacted example is sufficient. Keep observed results separate from your expectations. The [formal HR protocol](../superpowers/specs/2026-10-04-hr-pilot-validation-protocol.md) remains available for a future independent study; this walkthrough does not populate its participant dataset or calculator.
