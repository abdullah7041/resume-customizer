# Moyasar Payment Gateway — Implementation Plan (for Codex)

**Goal:** Let users pay to top up credits. Ship the **one-time credit pack** first (Phase 1). Monthly recurring is Phase 2 and is materially more complex — do NOT build it in the same pass.

**Stack context:** React 19 + Vite + Netlify Functions + Supabase + existing credit system (`netlify/lib/credit-manager.js`, `src/constants/pricing.ts`, `src/types/credits.ts`). Follow all rules in `CLAUDE.md` (`@/` alias, `watheq:` storage prefix, `[Component]` logs, error objects with `status`/`code`/`message`, never `any`, DB migrations are OUTPUT-only — user runs them in Supabase).

---

## 0. Decisions already made (do not re-litigate)

| Decision | Value | Why |
|---|---|---|
| Gateway | **Moyasar** | Local, mada + Apple Pay + STC Pay, SAR settlement. Stripe isn't available for a KSA entity. |
| Checkout method | **Invoices API (hosted page)** | No card data touches our backend → no PCI scope. mada/Apple Pay/STC Pay work out of the box. Minimal code. |
| Credit granting | **Webhook `payment_paid` is the source of truth** | Reliable even if the user closes the tab. `success_url` return is a secondary reconciliation. |
| Pack (Phase 1) | **9 SAR → 50 purchased credits** (`amount: 900`, SAR, VAT-inclusive) | ~3 full applications. Real AI COGS ≈ $0.08 → ~96% margin. |
| Monthly (Phase 2) | **29 SAR → 300 credits/month** | Requires tokenization + recurring cron. Separate phase. |
| Purchased credits | **Separate bucket, never wiped by monthly reset, no fast expiry** | The current cron hard-sets `credits_remaining`; without a separate bucket it deletes paid credits. |

**Amounts are integers in halalas** (1 SAR = 100). `amount` must be `>= 100`. Currency `SAR`.

---

## 1. Moyasar API reference (collected from docs.moyasar.com, Jun 2026)

**Base URL:** `https://api.moyasar.com/v1`
**Auth:** HTTP Basic. Username = API key, **password empty**. Secret key `sk_test_…`/`sk_live_…` (backend only). Publishable key `pk_test_…`/`pk_live_…` is frontend-only and NOT needed for the invoice flow. Sandbox = test keys (no bank interaction).

**Create Invoice** — `POST /v1/invoices` (secret key):
```json
{
  "amount": 900,
  "currency": "SAR",
  "description": "Watheq — 50 credits pack",
  "callback_url": "https://<site>/.netlify/functions/moyasar-webhook",
  "success_url": "https://<site>/purchase/success",
  "back_url": "https://<site>/pricing",
  "expired_at": "2026-07-12T00:00:00Z",
  "metadata": { "email": "user@x.com", "sku": "pack_50", "credits": "50" }
}
```
Response includes `id`, `status` (`initiated`|`paid`|`failed`|…), and **`url`** (hosted checkout — redirect the user here). `metadata` is echoed back in the webhook. NOTE: for invoices, `callback_url` is a **server POST notification**, not a user redirect (that's `success_url`).

**Fetch Invoice** — `GET /v1/invoices/:id` — for reconciliation. **Fetch Payment** — `GET /v1/payments/:id`. Verify `status == "paid"`, `amount`, `currency` before granting.

**Refund** — `POST /v1/payments/:id/refund` (for the refund policy; Phase 1 can be manual via dashboard).

**Webhooks** — register once via `POST /v1/webhooks`:
```json
{ "http_method": "post", "url": "https://<site>/.netlify/functions/moyasar-webhook",
  "shared_secret": "<MOYASAR_WEBHOOK_SECRET>", "events": ["payment_paid","payment_failed","payment_refunded"] }
```
Webhook body: `{ id, type, created_at, secret_token, account_name, live, data }` where `data` = the payment object (with echoed `metadata`). **Verification:** compare `body.secret_token` to `MOYASAR_WEBHOOK_SECRET` (constant-time). Also accept an `x-moyasar-signature` header if present, but `secret_token` match is the documented method.
**Rules:** return **2xx fast** (before heavy logic), Moyasar retries 6 attempts over ~2h on non-2xx. Events are at-least-once → **must be idempotent**.

---

## 2. Data model (migration — OUTPUT SQL, user runs it in Supabase)

Do NOT apply directly. Produce a migration file `supabase/migrations/<ts>_moyasar_purchases.sql` and print the SQL for the user.

```sql
-- 1. Purchased-credit bucket (separate from monthly free credits)
alter table user_credits
  add column if not exists purchased_credits integer not null default 0;

-- 2. Purchase/order ledger + webhook idempotency
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  sku text not null,
  credits integer not null,
  amount_halalas integer not null,
  currency text not null default 'SAR',
  moyasar_invoice_id text unique,
  moyasar_payment_id text unique,      -- set on payment_paid; dedupe key
  status text not null default 'pending', -- pending|paid|failed|refunded
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_purchases_email on purchases(email);
create index if not exists idx_purchases_invoice on purchases(moyasar_invoice_id);

-- 3. Processed webhook events (belt-and-suspenders idempotency by event id)
create table if not exists payment_events (
  event_id text primary key,
  type text not null,
  payment_id text,
  processed_at timestamptz not null default now()
);
```
Also extend the `credit_transactions.transaction_type` allowed values to include `'purchase'` and `'purchase_refund'` (update the CHECK constraint or enum if one exists; grep migrations for `transaction_type`).

---

## 3. Backend — Netlify functions

### 3a. `netlify/functions/create-purchase.ts`
- Auth: require a logged-in user (reuse existing auth pattern from `user-data-api`/other protected functions). Get `email` from the session, **never from the request body**.
- Body: `{ sku }` only.
- **Server-side SKU catalog** in `netlify/lib/purchase-catalog.js` — never trust client amount/credits:
  ```js
  export const SKUS = { pack_50: { credits: 50, amount: 900, currency: 'SAR', label: 'Watheq — 50 credits' } };
  ```
- Rate-limit per email (reuse existing limiter if present).
- Create invoice via Moyasar (`MOYASAR_SECRET_KEY`), `expired_at` = now + 24h, `metadata: { email, sku, credits }`, `callback_url` = webhook, `success_url` = `/purchase/success?invoice={CHECKOUT.ID}` (or static), `back_url` = `/pricing`.
- Insert `purchases` row (`status: 'pending'`, `moyasar_invoice_id`).
- Return `{ url }`. Errors as `{ status, code, message }`. Log `[CreatePurchase]`.

### 3b. `netlify/functions/moyasar-webhook.ts`
- Parse JSON. **Verify** `secret_token === process.env.MOYASAR_WEBHOOK_SECRET` (constant-time compare). Reject 401 otherwise. Reject if `live` mismatches the current key mode.
- **Idempotency:** `insert into payment_events(event_id...)`; if unique-violation → already processed → return 200 immediately.
- Handle `type`:
  - `payment_paid`: re-fetch payment via `GET /v1/payments/:id` with secret key to confirm `status=paid` + `amount`/`currency` match the `purchases` row (defense vs spoofed body). Then, in ONE transaction/RPC: set `purchases.status='paid'`, `moyasar_payment_id`, and **grant credits to the purchased bucket** (see 3c).
  - `payment_failed`: mark purchase `failed`. No grant.
  - `payment_refunded`: mark `refunded`; deduct from `purchased_credits` (floor at 0) and log `purchase_refund`.
- **Return 2xx fast.** Do email/notify as fire-and-forget (`Promise.resolve(...).catch(...)`), never block the 2xx.
- Log `[MoyasarWebhook]`. Netlify v2 syntax OK; keep well under the 30s timeout.

### 3c. `netlify/lib/credit-manager.js` changes
- Add `grantPurchasedCredits(email, credits, { purchaseId, paymentId })` → atomic `purchased_credits = purchased_credits + credits`, log `credit_transactions` with `transaction_type: 'purchase'`, idempotent on `paymentId`. Prefer a Postgres RPC `grant_purchased_credits(p_email, p_amount, p_payment_id)` mirroring `consume_user_credits`.
- **Update `checkCredits` / `consumeCredits`** so available = `credits_remaining + purchased_credits`. **Spend free (`credits_remaining`) first, then `purchased_credits`.** This is the core correctness change — both functions currently only read `credits_remaining`.
- Keep `FREE_TIER_CREDITS` single-source-of-truth untouched.

### 3d. `netlify/functions/cron-reset-credits.ts` — **REQUIRED FIX**
Current code hard-sets `credits_remaining = FREE_TIER_CREDITS` and `credits_total = FREE_TIER_CREDITS` (lines ~104–112). This is fine for the free bucket but **must not touch `purchased_credits`**. Confirm the update statement never writes `purchased_credits`, and that `credits_total` semantics don't double-count purchased. Add a test asserting purchased credits survive a reset.

---

## 4. Frontend (React)

- **Replace the waitlist CTA with a real buy button.** In `src/components/sections/PricingSection.tsx` and `src/components/Credits/PricingWaitlistModal.tsx` (and `CreditUsageModal.tsx`), swap the waitlist join for: call `POST /.netlify/functions/create-purchase { sku: 'pack_50' }` → on success `window.location = url` (redirect to Moyasar hosted page).
- Keep the Mixpanel events but rename intent → `purchase_started` (carry `sku`, `amount_sar`). Preserve `shown_price_sar`.
- **Success page** `src/pages/PurchaseSuccess.tsx` (route `/purchase/success`): on mount, refetch credit balance (existing `useUserCredits`/`CreditsContext`), show new balance + purchased amount. Don't grant here — webhook already did. If balance hasn't updated yet, poll 2–3× (webhook is usually <2s) then show "credits will appear shortly".
- **Paywall trigger:** the highest-intent moment is a free user hitting 0 credits mid-action. Ensure the buy CTA surfaces there (it already exists as `CreditUsageModal` — point its button at `create-purchase`).
- i18n: add EN + AR strings (`src/locales/{en,ar}/pricing.json`, `credits.json`). Keep prices VAT-inclusive; state "شامل ضريبة القيمة المضافة 15%".
- Update `src/constants/pricing.ts`: keep `PRO_LAUNCH_PRICE_SAR`, add `PACK_50 = { sku:'pack_50', priceSar:9, credits:50 }`. Locale `pricing.plans` price strings MUST match.

---

## 5. Env vars (add to Netlify + `.env.example`)
```
MOYASAR_SECRET_KEY=sk_test_...        # backend only
MOYASAR_WEBHOOK_SECRET=<random-long>  # must match the shared_secret used when registering the webhook
```
No publishable key needed for the invoice flow. (If a future JS-form flow is added: `VITE_MOYASAR_PUBLISHABLE_KEY`.)

---

## 6. Testing (sandbox first)

- Use `sk_test_` keys. Moyasar **test cards** (from docs `guides/card-payments/test-cards`) — include a mada test card and a 3DS success/fail card.
- Vitest unit tests (follow existing patterns in `netlify/lib/__tests__/`):
  - webhook: valid secret grants once; **duplicate event id grants zero** (idempotency); bad secret → 401; `payment_failed` → no grant; `payment_refunded` → deduct + floor at 0.
  - credit-manager: consume spends free before purchased; purchased bucket survives `cron-reset-credits`.
  - create-purchase: rejects unknown sku; uses server amount, ignores client-sent amount/credits.
- Manual E2E in sandbox: buy → hosted page (verify mada + Apple Pay show) → success_url → balance +50 → simulate refund → balance −50.
- Reconciliation check: if webhook is missed, `success_url` handler fetching the invoice should still confirm state (do NOT grant from the client — only display; a scheduled reconcile job that fetches `initiated`/`paid` invoices can back-fill grants).

---

## 7. Go-live checklist
1. Moyasar account approved (needs Saudi CR **or** freelance license + linked Saudi bank account; 2–5 business days). **This is the real critical path — verify before coding finishes.**
2. Publish **refund policy** + **contact** page (Moyasar requires these to activate live). Policy: pack refundable within 7 days only if 0 purchased credits used; auto-refund on charged-but-not-delivered.
3. Register the live webhook (`sk_live_`), set `MOYASAR_WEBHOOK_SECRET`.
4. Swap test → live keys in Netlify. Smoke-test one real 1-SAR purchase, then refund it.
5. Confirm VAT handling with Moyasar (invoices show VAT; ZATCA e-invoicing may apply).

---

## 8. Quality gate (per CLAUDE.md)
Cross-cutting change (schemas + stores + Netlify functions) → run the broad gate as **separate sequential** legs, not `quality:parallel`:
```
npm run lint
npm run type:check
npm run test -- --changed
```
Fix all errors before marking done. Migration SQL is OUTPUT-only — the user runs it. No `any`; define types in `src/types/` (e.g. `src/types/purchases.ts`).

---

## 9. Phase 2 (LATER — flag, don't build now): monthly 29 SAR recurring
Moyasar has no turnkey subscriptions in the core API. Recurring = **tokenization**: first charge with `save_card: true` (requires Tokenization feature enabled on the account) → store `source.token` (encrypted, never the PAN) → a monthly cron charges the token via `POST /v1/payments` with `source: { type:'token', token }`. This adds: token storage/security, a billing cron, **dunning** (retry/expire/notify on failed renewals), proration, and cancel logic. Given current real volume (~12 paid actions/month), this is premature — ship Phase 1, get first payers, then decide. A lower-complexity interim option: a **"30-day 300-credit pass"** sold as a one-time pack (no auto-renew) reusing the entire Phase 1 flow.
