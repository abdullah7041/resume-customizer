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
| `job_description_submitted` | User clicks Analyze Match | `language` |
| `match_analysis_started` | Match API request sent | `language` |
| `match_analysis_success` | Match API success | `score_bucket` |
| `match_analysis_failed` | Match API failure | `error_category` |
| `optimization_failed` | Optimize API failure | `error_category` |
| `export_clicked` | Export button clicked | `template_id`, `format` |
| `export_success` | Export completed | `template_id`, `format` |
| `export_failed` | Export failed | `template_id`, `format`, `error_category` |
| `waitlist_joined` | Waitlist insert success | `source` |
| `feedback_submitted` | Feedback API success | `rating`, `has_testimonial`, `context_feature` |
| `pricing_intent_pack_9_sar` | Fake-door anchor click | `source` |
| `pricing_intent_monthly_29_sar` | Fake-door anchor click | `source` |

---

## 1.1 Missing Event Gaps

- Sign-in/sign-up intent events exist in the analytics service but still need wiring to the auth entry points before launch reporting depends on them.
- Export analytics is owned by the actual export handlers in `TemplatesSection.tsx`; do not add export tracking to non-export components.
- Avoid duplicate emissions: when a Phase 4 success/failure event covers a user action, do not emit an equivalent legacy event for the same action unless the dashboard explicitly requires both.

---

## 2. Feedback Questions

After value moments (match success, optimize success, export success, pipeline save), users see an optional feedback modal with:

1. **Emoji rating** (love / happy / neutral / sad / terrible)
2. **What felt wrong or generic?** (optional short text)
3. **Would you trust this resume enough to apply?** (Yes / Somewhat / No)
4. **Would you pay for this if it saved you time?** (Yes / Maybe / No)

Session dedup: max **one feedback prompt per session**.

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
| AI cost logging working | Confirmed |
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
