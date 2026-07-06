/**
 * Single source of truth for the Pro plan's planned launch price.
 *
 * Shown on the pricing card + waitlist modal, and sent to Mixpanel as
 * `shown_price_sar` on `waitlist_joined` / `pricing_intent_clicked` so a
 * later price change can be cohort-compared (launch decision 2026-07-06).
 *
 * The locale strings `pricing.plans.pro.price` (en/ar) MUST match this number.
 */
export const PRO_LAUNCH_PRICE_SAR = 29;
export const PRO_LAUNCH_BILLING_PERIOD = 'month';
