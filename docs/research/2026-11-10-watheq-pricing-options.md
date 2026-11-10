# Watheq pricing options for decision

Research date: 10 November 2026. Branch inspected: `codex/geidea-integration`.
Status: recommendation only. No paid benefits, checkout package, subscription, or production entitlement is authorized or implemented by this report.

## Recommendation

Keep the existing free experience. For the first paid offer, prefer **9 SAR once for 20 additional credits**, with no renewal and no expiry, over launching a recurring subscription immediately. Keep **29 SAR/month for 100 total monthly credits** as the alternative for active applicants, conditional on evidence of repeat use and measured costs. These are proposed test prices and allowances, not validated willingness to pay or proven profitable packages.

This is a small paid extension of the product users already understand. It avoids making up premium features to justify charging. Users pay for additional successful AI work; resume editing, the existing templates, uploads, and exports remain accessible. Do not promise unlimited AI, a hiring outcome, human review, premium templates that do not exist, voice/video interviews, or priority support without delivery capacity.

Saudi competitors already advertise subscriptions at 29 SAR. Watheq's defensible proposition must therefore be the quality and clarity of its evidence-based, job-specific Arabic/English workflow, rather than being the only local or inexpensive option. That quality still needs user validation.

## Evidence boundaries

- **Verified repository behavior** means inspected source on this branch, not a newly exercised production transaction or deployment check.
- **Verified competitor offer** means an official public page was retrieved on the research date. It does not establish successful Saudi checkout, output quality, popularity, regulatory compliance, or whether every advertised feature works.
- **Proposal/inference** identifies a product decision or interpretation, rather than a fact demonstrated by usage or revenue data.
- Dollar prices below are the public USD offers shown by the sources. No currency conversion, card FX fee, tax adjustment, promotion, or Saudi checkout total is assumed. Credit units are not comparable between vendors.

## Global competitors available as online alternatives

| Product | Official advertised price and actual billing period | Free/paid boundaries relevant to Watheq | Implication |
| --- | --- | --- | --- |
| Rezi | Pro **$29/month**; Lifetime **$149 once**. Help documentation also lists quarterly Pro at $19/month billed quarterly, and warns regional prices can vary. | Free: one resume, one AI interview, three PDF downloads, standard template, limited advanced tools. Pro advertises unlimited resumes, AI, downloads, templates, and one human review monthly. Lifetime excludes that monthly human review. | Established tooling bundles more than rewriting. Its lifetime economics are not evidence Watheq can fund lifetime AI. [Pricing](https://www.rezi.ai/pricing), [plan details and regional caveat](https://intercom.help/rezihelp/en/articles/8383549-subscription-plans). |
| Teal | **$13/week**, **$29/month**, **$79/quarter**, **$179/year**, each a separate billing commitment. | Free: unlimited resumes/job tracking, ten templates, basic analysis, top five JD keywords; AI bullet/summary/letter grants are limited. Teal+ advertises unlimited AI writing and full keyword/analysis access. Subscriptions automatically renew until canceled. | A free tracker or free resume count is a weak standalone premium differentiator. Short search periods are already monetized weekly. [Official plan comparison](https://help.tealhq.com/en/articles/9530153-teal-vs-teal), [pricing](https://www.tealhq.com/pricing), [renewal terms](https://www.tealhq.com/terms). |
| Kickresume | **$24/month**; **$54 every three months** (displayed $18/month); **$96 every twelve months** (displayed $8/month). | Free: four resume and four matching letter templates, unlimited documents/downloads. Paid: 40+ templates, AI writing/checker, imports and other career tools. Public pricing does not establish an unlimited AI generation allowance. | PDF exports need not be a paywall. Lower advertised monthly equivalents require longer upfront billing. The live pricing page supersedes the older help article showing $19/$13/$7. [Current pricing and comparison](https://www.kickresume.com/en/pricing/). |

Enhancv was checked but excluded from numerical benchmarking: its retrieved pricing page rendered `NaN` and €0 in the paid pricing area. Its free plan is described as seven days with branding and twelve section items; a reliable current paid total was not available from that render. Do not repeat its headline starting price as an independently verified monthly quote. [Official page](https://enhancv.com/pricing/).

## Saudi and regional reference points

These are local positioning references, not audited substitutes of equal scope or quality.

| Product | Public price and limits | Implication for Watheq |
| --- | --- | --- |
| سيرتك / Ceera | **29 / 49 / 99 SAR monthly**, advertised VAT-inclusive; annual totals **290 / 490 / 990 SAR**. Free lists two resumes, 30 AI points/month, five ATS runs/month, and limited interview/letter uses. The 29 SAR tier lists 150 AI points, 50 ATS runs and fifteen text interview sessions monthly, with voice/video minute allowances. | Direct Arabic-first Saudi AI competition exists at Watheq's planned 29 SAR price. Its point system cannot be equated to Watheq credits. Voice/video are competitor claims, not Watheq capabilities. [Pricing](https://www.ceera.tech/pricing), [Saudi positioning and cancellation FAQ](https://www.ceera.tech/faq). |
| CVsHERE | Pricing FAQ advertises **29.99 SAR for a week pass**. Building/preview are free; payment purchases PDF download plus editing access. The page explicitly says no subscription or automatic renewal, and lists mada/Apple Pay/cards. | A local nonrenewing purchase is a real alternative to monthly subscriptions. The page describes English output from Arabic input; its assertion about ATS reading English is vendor wording, not a general fact adopted here. The dynamic price block says loading, so the quoted amount is specifically from its same-page FAQ, not a completed checkout. [Official pricing](https://www.cvshere.com/en/pricing). |
| سيرة / resume.sa | Human-assisted writing starts **149 SAR/order**, resume + LinkedIn starts **249 SAR/order**, career positioning starts **999 SAR/order**. Final total varies by experience/language/add-ons. Includes human review, PDF/Word, one revision; the second language adds 99 SAR. | A different service category. These prices do not justify claiming Watheq replaces a professional reviewer or can charge the same for automated output. [Official services](https://www.resume.sa/services). |

**Inference:** a 9 SAR refill could suit an occasional applicant who has exhausted the free allowance and dislikes renewal. A 29 SAR subscription could suit frequent tailoring. Neither proposition has been validated by purchase behavior in this research. Public competitor pages are supply evidence, not demand, market share, or demonstrated customer satisfaction.

## What Watheq actually provides today

Repository references: `netlify/lib/credit-manager.js`, `netlify/functions/cron-reset-credits.ts`, `netlify.toml`, `src/constants/pricing.ts`, `src/components/Credits/PricingWaitlistModal.tsx`, `src/components/sections/PricingSection.tsx`, `src/pages/LandingPage.tsx`, `src/locales/en/pricing.json`, `src/locales/en/landing/majlis.json`, `src/components/templates/registry.ts`, and `CLAUDE.md`.

| Existing capability | Current credit cost per separately billed action |
| --- | ---: |
| Resume parsing/upload | 0 |
| Match analysis against a job | 2 |
| Resume optimization | 5 |
| Interview-question preparation | 3 |
| Cover letter | 4 |
| Vision 2030 analysis | 2 |
| Template export | 0 |

The product includes Arabic/English workflows, questions before evidence-dependent rewrites, user-controlled application of suggestions, job-specific analysis, saved work, and four registered templates. This is meaningful differentiation in workflow emphasis; it is not proof of unique technology, superior recruiter outcomes, or strict Arabic PDF-reader compatibility. The product's match score estimates alignment to the supplied job, not probability of hiring.

Current published plans are Free plus a **waitlist-only 29 SAR/month Pro**. Pro copy promises only more optimization credits, more saved/tracked jobs, and early improvements; no numeric Pro allowance is committed. The optional 9 SAR preference survey exists in the modal but is hidden by default. A waitlist selection is not a paid conversion. One pricing locale says five templates while the registry and landing page have four; package copy should follow the actual four rather than expand that promise.

Normal confirmed accounts receive **20 credits** initially. Unverified accounts initially receive zero; suspicious IP signup handling reduces the initial grant to five. A daily scheduled reset finds balances last reset more than thirty days ago and sets both remaining and total credits to twenty. This is a rolling reset, not a calendar-month additive grant. Actual cron operation was not checked here.

That reset writes the shared balance. **A purchase cannot safely be represented merely by adding credits to that balance:** a future reset can overwrite it. Nonexpiring paid credits require separate durable accounting and spending rules before any paid pack is sold. This report does not implement them.

## Concrete package choices

All paid entries below are proposals for approval. Treat the displayed SAR amount as the intended customer total; confirm applicable tax handling and contracted payment fees before publication.

| Option | Proposed offer | Allowance and expiry | Why / tradeoff |
| --- | --- | --- | --- |
| Free — retain | **0 SAR** | Existing 20-credit rolling allowance; existing upload, editor, templates and export access. Preserve existing account/abuse safeguards. | Demonstrates usefulness before purchase; no new artificial feature restrictions. |
| Application refill — recommended first paid offer | **9 SAR once** | **20 purchased credits**, additional to free credits, no renewal, no expiry. Spend free credits first; paid balance survives reset. | Simple occasional-use purchase with bounded paid AI entitlement. Adds no speculative premium features. Nonexpiring liability remains capped by purchased units. |
| Active search — alternative/later | **29 SAR/month** | **100 total monthly credits, including the existing 20 free allowance**: the paid increment is 80, not 100+20. Unused subscription credits expire at period end; any separately bought refill survives. | More room for frequent tailoring. Requires billing-cycle, cancellation, refund and entitlement behavior. No recurring charge until those are actually delivered and repeat-use demand supports it. |
| Nonrenewing alternative if monthly demand is weak | **29 SAR once** | Same 100-total-credit target during a clearly stated 30-day pass, including the free allowance for that period. No renewal. Paid increment must last the full purchased period despite any free reset. | Similar customer budget, explicit end, fewer recurring obligations. Still requires accurate period accounting. Offer this instead of a confusing duplicate subscription, not as a fourth launch tier. |

Usage examples assume fresh, separately billed actions at the current costs, with no reruns. They describe credit arithmetic, not a guarantee that each complete application needs exactly these calls:

- Match + optimization: **7 credits**. Twenty credits cover two such combinations with six left; 100 cover fourteen with two left.
- Match + optimization + interview preparation + cover letter: **14 credits**. Twenty cover one with six left; 100 cover seven with two left.
- Add Vision 2030 analysis to that combination: **16 credits**. Twenty cover one with four left; 100 cover six with four left.
- A refill contributes twenty extra credits; these examples do not add the free balance again. A recurring 100-credit offer provides eighty extra credits over the existing free entitlement.

Avoid calling the 9 SAR refill a guaranteed application pack unless the UI defines exactly which successful operations it includes. Do not charge again for reading a saved result or polling a pending job. Define failed/duplicate operation credits, payment refunds, and the order of spending before any package goes live.

## Costs: what is known and what is missing

The authoritative monetary source is provider billing and contracted payment/infrastructure charges. The repository does **not** establish actual cost per successful application or per paying user.

- `netlify/lib/model-registry.js` explicitly labels token rates approximate, last checked 26 July 2026, and says not to use them as billing truth.
- `netlify/lib/openrouter-client.js` estimates USD cost from token counts. `netlify/lib/ai-usage-logger.js` writes `ai_usage_events`, including model/provider, tokens, latency, success/error and `estimated_cost_usd`. Logging failures are nonfatal and persistence has a timeout, so completeness cannot be assumed.
- The table migration `supabase/migrations/20260521_add_ai_usage_events.sql` has an estimated-cost column, not a reconciled provider-billed-cost column. Optional per-user/JD attribution is controlled by `AI_USAGE_USER_ATTRIBUTION`; its live setting was not inspected.
- Zero user-credit price does not mean zero operating expense. Parsing/OCR, free/guest use, validation calls, provider failures/fallbacks, server PDF generation, storage, email and support all matter. Some consume resources without a one-to-one paid-credit event.
- No production usage export, OpenRouter/Google invoice, Netlify/Supabase bill, Geidea commercial fee schedule, refund/chargeback history, active-user cohort, or real willingness-to-pay dataset was reviewed. No gross margin or cost ceiling is asserted.

Before selling, reconcile one representative recent cohort's provider charges with completed workflows, including failed attempts, OCR, auxiliary AI calls and free usage. Measure median and upper-tail spend, logging gaps, and support/refund burden. Evaluate **full allowance redemption**, not just average light use.

Use this decision equation with real inputs:

`Contribution per purchase = retained revenue after applicable tax, payment fees and refunds − actual AI spend − variable infrastructure/support − allocated free-user subsidy`

The acceptable contribution and reserve are owner decisions. If a fully redeemed 20-credit refill or 80-credit subscription increment does not leave the chosen reserve, reduce allowances or change the price before publishing. Matching a competitor's price is not a substitute for that check.

## Decision requested

Choose the **9 SAR / twenty purchased credits** offer first, retaining Free and keeping the 29 SAR recurring idea on the waitlist until costs and repeat use justify it. The alternative is the **29 SAR / 100 total credits** monthly plan; if users prefer occasional purchases, use its explicit nonrenewing 30-day version instead.

Approval of a price is distinct from launch readiness. Next work would specify paid-credit preservation, successful-operation charging, refund treatment, receipts and any subscription lifecycle. Current application code and paid benefits remain unchanged by this research.

## Verification

Official pages were opened on the research date. Code discovery used CodeGraph first, with focused RTK reads/searches for configs, migrations and locale promises. Some guessed paths did not exist; discovery continued with actual repository paths. No dependency or tool configuration changed. Docs-only verification: `git diff --check` (run after writing this file).
