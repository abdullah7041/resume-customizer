# Watheq launch offer — decision version

**Superseded after user review.** The approved offer is SAR 29 once for 100 nonexpiring purchased credits. See [the implementation and activation guide](../application-credits.md). The earlier SAR 9 proposal below is retained as research history.

Prepared 10 November 2026. **Proposal, not a published offer.** The GEIDEA branch enables sandbox qualification only. Source detail: [regional competitors](2026-11-10-regional-resume-competitors.md) and [product, credit and cost analysis](2026-11-10-watheq-pricing-options.md).

## Recommended decision

Launch with **Free + a SAR 9 one-time refill of 20 additional credits**. Keep the planned SAR 29 monthly Pro plan on the waitlist while measuring repeat use, actual costs, and paid conversion. Do not add a subscription or promise unlimited generation at this stage.

This is an introductory test offer: public competitor prices establish alternatives, not willingness to pay or profitability. If fully redeemed credits fail the owner's contribution target after actual provider costs and contracted GEIDEA fees, change the allowance or price before selling.

| Final proposed package | Free | Application refill |
| --- | --- | --- |
| Price | SAR 0 | **SAR 9 once**; intended displayed customer total, subject to tax/fee confirmation |
| Credits | Existing 20-credit rolling allowance, with existing verification/abuse safeguards | **20 extra paid credits** |
| Renewal / expiry | Existing approximately 30-day reset | No automatic renewal; purchased credits do not expire |
| Resume upload, manual editing, four templates, PDF export | Included | Same access |
| AI features | Same tools, subject to balance | Same tools, more usage |
| Spending | Use available free credits first | Paid credits are used after free credits and survive free resets |

**Customer-facing English proposal:** “Need more credits? Add 20 credits for SAR 9. Pay once. No subscription. Purchased credits do not expire.”

**Arabic proposal:** «تحتاج رصيدًا إضافيًا؟ أضف 20 رصيدًا مقابل 9 ريالات. دفعة واحدة بلا اشتراك، والرصيد المشترى لا تنتهي صلاحيته.»

Do not label this “20 applications.” At today's individual action costs, 20 credits cover two match-and-optimize combinations (7 each), or one match + optimization + cover letter + interview-preparation combination (14), with the remaining balance available for other actions. These examples exclude reruns and the separate free allowance. Vision 2030 analysis costs another 2 credits. Failed/duplicate billing and refund treatment must be specified before sales.

## Regional alternatives a buyer can already see

| Official public offer, checked November 10 | What the price buys | Watheq implication |
| --- | --- | --- |
| [osaCV — SAR 19/CV](https://osacv.com/en/pricing) | One CV; 24-hour editing window; PDF/Word/image | Strong one-document anchor; different editing entitlement |
| [Sera — SAR 25/month](https://seracv.app/pricing) | Advertised unlimited job-specific Arabic/English CV generation; DOCX | Direct repeat-use price pressure |
| [Ceera — from SAR 29/month](https://www.ceera.tech/en/pricing) | Plus: 150 AI points, 50 ATS checks, broader career tools; VAT included | Watheq's planned monthly price is already a regional entry tier |
| [Sira by Rabit — SAR 35/24h or SAR 99/90 days](https://cv.rabit.sa/ar/pricing) | Nonrenewing application/search packages; tailoring and supporting tools | Time-bounded job-search purchases are an established alternative |
| [Vocatra — from SAR 39/year](https://vocatra.com/pricing) | Annual access with monthly usage and export limits | Very low advertised entry price; it is annual, not monthly |

Advertised features are not independently tested quality or demonstrated hiring outcomes. Vendor credits use different action costs. Sera and Sira are different products. Tax treatment is not established for every offer. Rezi and Teal also advertise US$29 monthly; Kickresume advertises US$24 monthly, with lower monthly equivalents requiring quarterly/annual commitments. [Global sources and caveats](2026-11-10-watheq-pricing-options.md#global-competitors-available-as-online-alternatives).

## What Watheq can credibly compete on

Arabic/English, ATS scores, AI rewriting, factual claims, and user approval are already advertised regionally. They are shared capabilities, not a proven unique advantage. Watheq's best positioning hypothesis is **clear evidence handling for each specific job**: show what the source supports, ask before strengthening a claim, explain real gaps, and let the candidate review changes. Validate exported documents and Arabic reading order separately; “ATS-friendly” is not a guarantee.

Avoid charging for premium features that do not exist. Watheq currently implements analysis, optimization, cover letters, interview questions, Vision 2030 analysis, saved work and four templates. It does not establish human review or voice/video interviewing. The free experience should continue demonstrating these tools.

## Implementation consequences before paid launch

1. **Separate paid and free credits.** The existing reset replaces the shared balance with 20; simply adding paid credits would allow that reset to erase the purchase. No paid-credit changes are included in this branch.
2. **Grant exactly once from verified payments**, through an atomic payment-and-credit transaction; never from a browser redirect or success callback alone. Preserve the existing behavior that reading/polling results is free.
3. **Define refunds and failure charging**, receipts, support ownership and customer-total tax treatment. Reconcile actual AI/provider bills, infrastructure and contracted payment fees; current estimated token costs do not establish margins.
4. **Qualify deployed callbacks and persistence.** Visa/Mastercard/mada gateway payments passed in the sandbox, but database migration and deployed function verification remain separate steps.

If buyers later demonstrate frequent repeat use and costs support it, test **SAR 29/month for 100 total monthly credits** (80 above the existing free 20), rather than equating competitor credit counts. Define cancellation, renewal and period boundaries before enabling recurring payments. This is a later option, not a second launch offer.

**Decision to make:** approve or revise SAR 9 / 20 nonexpiring paid credits as the first offer. The branch is ready for review without making that commercial decision on the user's behalf.
