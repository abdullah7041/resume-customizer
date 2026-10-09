# HR pilot validation protocol v2

Date: 2026-10-04, Asia/Riyadh. Status: reviewable offline preparation; no participant evidence. Targets below were set before running fictional calculator checks. Real enrollment/collection requires explicit authorization and actual preregistration. This specification adapts the preserved uncommitted protocol in the candidate-trust-foundations checkout; see [provenance and local harness](../../hr-pilot/README.md).

Evaluate the actual candidate-controlled job requirement/evidence report: exact job excerpts manually associated with supplied facts, source snapshots, individually included clarifications, visible gaps and uncertainty. An association is unverified; do not turn it into automated qualification proof. Scores remain alignment estimates, never hiring probabilities or recommendations. Hide scores in the review task. Do not create recruiter workspaces or contact participants.

## Preregistered sample and assignment

Minimum 12 complete consenting candidate/job pairs and four active consenting HR reviewers: four English, four Arabic, four mixed-language cases. Each case receives two reviews by different reviewers: baseline (approved resume + exact JD), packet (same inputs + candidate-approved report). Nobody sees a case twice. Human facilitator randomizes allocation and order, balances language/condition across reviewers, confirms language and role familiarity, then locks the schedule before sessions. Record protocol/allocation locks and inclusion/exclusion decisions privately. This exploratory sample is not statistically powered to establish accuracy, fairness or causal hiring improvement. Missing strata or withdrawn cases block the feasibility decision; do not substitute fixtures.

The case schema records full resume/JD snapshot IDs and complete UTF-8 SHA-256 hashes separately from `EvidenceSource` excerpt ID/kind/targetId/fingerprint. The full hashes equal the existing assessment context fingerprints; excerpt hashes retain their own identity. `reportMaterials()` converts a current `CandidateEvidenceReport` to these identities for private case preparation. Candidate approval binds context key, packet version, exact packet hash and the source inclusion manifest hash. Every included source separately binds its excerpt hash, context, version and manifest. Source edits/additions and packet changes require renewed approval. Each review records the snapshot IDs/hashes it actually received; packet reviews also name the approved version/hash/manifest. Its condition, reviewer and order must match the locked allocation. These identity checks are necessary record consistency checks; facilitators still verify actual delivery and consent.

## Entry and privacy gates

Explicit authorization for actual contact, collection and sharing; approved private storage, access, deletion and withdrawal route; separate candidate participation and exact-version/per-source sharing consent; reviewer participation/timing consent. Candidate approves the whole packet and each included clarification. New context/source/claim creates a new packet version and renewed approval. Private clarifications never silently enter the application resume. Source snapshots and actual exported delivery must be inspected for substantive Arabic/English facts and reading order; unresolved PDF limitations require a candidate-reviewed alternative format. Two independent human annotators label supplied evidence before resolving all disagreements; retain initial labels and hidden adjudicated reference. Neither source quotations nor candidate confirmation establish external authenticity. Use [consent/session prompts](../../hr-pilot/consent-and-session-prompts.md); no recordings by default. Real records belong outside this repository.

## Measures and targets fixed before results

Report counts, denominators, unavailable cells, exclusions, case variation and EN/AR/mixed breakdowns. A pooled pass cannot hide a failing stratum. Human audits establish the reference; this harness only calculates records.

| Measure | Denominator and target |
| --- | --- |
| Unsupported substantive packet claims | Audited unsupported claims / all substantive claims actually included. Zero unsupported additions; any breach stops affected sharing and expansion pending correction. Record initial preparation errors even after correction. |
| Unconsented disclosure/provenance | Every included source approved for exact context/packet; all substantive claims trace to included sources. Any breach blocks valid calculation/sharing. |
| Missed qualifications | Reviewer misses / reference-supported requirements, separately essential. Packet rate no worse than baseline; essential miss rate <=5%. No supported items means unavailable, not zero. |
| Incorrect supported findings | Reviewer marks supported / reference partial, not_evidenced or ambiguous requirements. Packet rate no worse than baseline; absent negative reference items means unavailable. |
| Reference disagreement | Two initial annotators disagree / all requirements, before adjudication, <=20%. All differences adjudicated with reasons. Baseline/packet differences are condition differences, not pure inter-rater reliability. |
| Preparation corrections | Distinct reviewed rows with substantive pre_share correction / all reviewed rows, <=15%. Stage/role breakdowns retained; repeats on one row count once. Reviewer corrections separate. |
| Review time | Median active seconds per condition, elapsed minus pauses. Packet median >=20% lower while quality targets hold. Retain case-paired differences; different reviewers limit causal attribution. Missing/invalid timing invalidates the calculation. |
| Comprehension | Every reviewer explains provenance is not independent verification and alignment is not hiring probability. Record each review response; all must meet both. |

Targets are feasibility choices, not established benchmarks. Empty/no-denominator records stay unavailable. Invalid records yield no metrics. Simulation always remains insufficient for empirical validation. Participant results meeting all targets permit considering another limited study; they do not authorize deployment, autonomous rejection, ranking or screening reliability claims. Review adverse cases and raw distributions before any decision.

## Remaining participant work

Approve the concrete cohort, storage/retention and contact/collection plan; obtain actual consent; freeze the protocol and randomized allocation; inspect real candidate packets; independently annotate; conduct 24 paired reviews; retain corrections/timing and withdrawals; calculate and manually audit results; report negative and inconclusive findings. No step is complete merely because a script or fixture passes. Interview progression may be contextual follow-up with separate consent; it cannot establish assessment accuracy or causal hiring benefit.
