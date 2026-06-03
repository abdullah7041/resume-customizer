# Validation and Launch Decision Plan

## Overview
This document defines the beta validation funnel, success metrics, and launch/no-launch decision criteria for Watheq.

---

## 1. Funnel Events

### Existing Events (already instrumented)
| Event | Purpose |
|-------|---------|
| `resume_upload_started` / `resume_upload_completed` / `resume_upload_failed` | Upload tracking |
| `match_analysis_run` | Legacy match score bucket helper; do not emit alongside `match_analysis_success` for the same user action |
| `optimization_started` / `optimization_completed` / `optimization_applied` | Optimization flow |
| `pdf_exported` / `docx_exported` | Export tracking |
| `pricing_intent_clicked` | Generic pricing interest |
| `pipeline_save_clicked` / `pipeline_job_saved` / `pipeline_save_failed` | Pipeline tracking |
| `feature_used` | Feature usage by type |

### New Events (Phase 4)
| Event | Trigger | Properties |
|-------|---------|------------|
| `landing_viewed` | Landing page mount | `language` |
| `get_started_clicked` | Any primary CTA | `source: hero/walkthrough/final_cta` |
| `signin_started` | Google sign-in OAuth initiated | `source: header_desktop/header_mobile/landing_get_started` |
| `signup_started` | Google sign-up OAuth initiated | `source: header_desktop/header_mobile/landing_get_started` |
| `job_description_submitted` | User clicks Analyze Match | `language` |
| `match_analysis_started` | Match API request sent | `language` |
| `match_analysis_success` | Match API success | `score_bucket` |
| `match_analysis_failed` | Match API failure | `error_category` |
| `optimization_failed` | Optimize API failure | `error_category` |
| `export_clicked` | Export button clicked | `template_id`, `format` |
| `export_success` | Export completed | `template_id`, `format` |
| `export_failed` | Export failed | `template_id`, `format`, `error_category` |
| `waitlist_joined` | Waitlist insert success | `source` |
| `feedback_submitted` | Feedback API success | `feedback_type`, `rating`, `rating_bucket`, `has_message`, `trust_to_apply`, `willingness_to_pay`, `context_feature` |
| `pricing_intent_pack_9_sar` | Fake-door anchor click | `source` |
| `pricing_intent_monthly_29_sar` | Fake-door anchor click | `source` |

---

## 1.1 Event Ownership and Open Reporting Gaps

- Sign-in/sign-up intent wiring is complete in `src/hooks/useAuth.tsx`; current shipped entry points call it from desktop header sign-in, mobile header sign-in, and landing get-started. Do not re-open this as an app-code gap unless a new auth entry point is added without `intent`/`source`.
- Export analytics is owned by the actual export handlers in `TemplatesSection.tsx`; do not add export tracking to non-export components.
- Avoid duplicate emissions: when a Phase 4 success/failure event covers a user action, do not emit an equivalent legacy event for the same action unless the dashboard explicitly requires both.
- Launch readiness still requires real Mixpanel/dashboard review and production event volume against the thresholds below; code instrumentation alone does not satisfy the launch criteria.
- 2026-06-02 Supabase live-state review found no auth logs in the prior 24 hours, no auth users after 2026-04-07, no `ai_usage_events` rows or inserts, no `job_applications` rows, and no adjacent persisted app activity after 2026-05-09. `signin_started` / `signup_started` visibility remains intentionally unconfirmed until Mixpanel or production traffic is reviewed.

---

## 2. Feedback Questions

Current shipped state: authenticated users can open the manual feedback modal from the header. Automatic value-moment prompting is not currently wired.

The manual modal collects:

1. **Rating** (optional 1-5 satisfaction signal)
2. **What felt wrong, generic, or confusing?** (required meaningful text)
3. **Would you trust this resume enough to apply?** (Yes / Somewhat / No)
4. **Would you pay for this if it saved you time?** (Yes / Maybe / No)

When automatic value-moment prompting is added after match success, optimize success, export success, or pipeline save, apply session dedup with `watheq:feedbackPromptedThisSession` so the prompt appears at most once per session.

Implementation note: until a feedback metadata column/RPC parameter exists, the backend persists only allowlisted validation answers in a compact `watheq_feedback_validation` footer on the stored feedback message. Duplicate detection intentionally includes that footer because `message_hash` is computed from the final stored report body.

---

## 3. Minimum Signals Before LinkedIn Launch

| Signal | Target |
|--------|--------|
| Users who tried the app | 50 |
| Completed match analysis | 30+ |
| Completed optimization | 20+ |
| Completed export | 10+ |
| Saved jobs to pipeline | 5+ |
| Submitted feedback | 10+ |
| Showed pricing intent | 5+ |
| Critical trust/privacy bugs | 0 |
| Recurring AI hallucination complaints | 0 |
| Recurring export/formatting failures | 0 |

---

## 4. Payment Readiness Criteria

| Criterion | Target |
|-----------|--------|
| Users indicating willingness to pay | 5–10 |
| Active testers clicking pricing-intent CTA | 20–30% |
| Users asking for more credits/exports/packs | Observable |
| AI cost logging working | Pending first observed production AI request and corresponding `ai_usage_events` insert |
| No major trust/privacy issues | Confirmed |

---

## 5. Launch / No-Launch Decision Rules

### Go for LinkedIn launch if ALL true:
- [ ] 50+ users tried the app
- [ ] 30+ match analyses completed
- [ ] 20+ optimizations completed
- [ ] 10+ exports completed
- [ ] 5+ pipeline saves
- [ ] 10+ feedback submissions
- [ ] 5+ pricing-intent signals
- [ ] Zero critical trust/privacy bugs
- [ ] No recurring AI hallucination complaints
- [ ] No recurring export/formatting failures

### Do NOT launch if ANY true:
- [ ] Critical privacy or data-leak bug
- [ ] Recurring AI hallucination (invented employers, degrees, metrics)
- [ ] Recurring export failure >20% of attempts
- [ ] Less than 5 users show pricing intent
- [ ] Feedback indicates low trust in outputs
- [ ] Any unsupported claim in copy (e.g., "guaranteed interviews")

---

## 6. Privacy Safeguards

- No raw resume text in analytics
- No raw job descriptions in analytics
- No full AI outputs in analytics
- Score buckets only (0-39, 40-59, 60-79, 80-100)
- Error categories only (no stack traces)
- Safe metadata: language, source, feature name, status, file type, model id (backend only)
