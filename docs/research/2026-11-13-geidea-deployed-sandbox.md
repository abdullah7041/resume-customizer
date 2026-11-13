# Deployed GEIDEA sandbox qualification

Checked November 13, 2026 on `https://codex-geidea-integration--resume-optimizing.netlify.app` at commit `92ad428`. Customer checkout enabled, environment sandbox, fixed SAR 29 / 100-credit offer. Credentials are saved only for `codex/geidea-integration`; API password is secret. Production was not deployed or enabled.

## Executed payments

| Brand | Purchase ID | GEIDEA order ID | Persisted callback result |
| --- | --- | --- | --- |
| Visa | `1a6bf56d-8e5d-43ab-949d-02ec336df056` | `2caa7c54-0510-4c1c-3f8f-08df3eb12e49` | succeeded, zero paid credits, no grant timestamp |
| Mastercard | `6d0870d8-2f40-46ce-ba63-e708ea9f9f18` | `7ef88688-c29c-4969-c46f-08df3f1c61b1` | succeeded, zero paid credits, no grant timestamp |
| mada | `f6da3442-0246-41b9-a630-ee75259273d8` | `90862e4d-c136-4107-3fa7-08df3eb12e49` | succeeded, zero paid credits, no grant timestamp |

Visa session creation used the signed-in customer's real `/checkout` UI and deployed authenticated endpoint. The user clicked Prepare Payment because native automation could not activate the button. The hosted test payment then ran in installed Edge headless. For supplemental Mastercard/mada tests, the same local gateway helper created sessions and the service role inserted sandbox fixtures for that account. All three used the deployed webhook. Browser returns were intercepted before navigation, so the succeeded ledger rows establish actual webhook/HMAC/order-verification/SQL processing without frontend reconciliation.

Mastercard and mada orders were also independently fetched by the authenticated order verifier. Three concurrent, correctly signed replays for the Visa order each returned HTTP 200; the persisted status stayed succeeded with zero remaining purchased credits and no grant timestamp. The account balance after the three payments was 20 total, 20 free, zero purchased.

## Other checks and findings

- GET configuration returns enabled, priceSar29, credits100, environmentsandbox. The migrated purchase/debit tables and free/purchased columns are accessible.
- Apple association file is 9,119 bytes, SHA-256 `576b62156cdb73e789ec0a2cba1c9b03aae0623ab39d3c0d505b193848f15f21`.
- Cancelling before entering a card returns response073 and `orderId=null`. Purchase `f2b10187-4026-4119-8692-05fe0fdf721a` remained pending with no order or grant. There is no verified provider order to reconcile in that case. This does not demonstrate a final cancelled ledger status.
- Checkout showed pending for verified sandbox successes because its success presentation required a live credit grant. A focused regression reproduced this, then passed after adding an explicit Arabic/English sandbox success message. All six checkout tests, touched-file lint, translation validation and whitespace checks passed.

## Remaining qualification

No real-money payment, production grant, monetary refund, declined-payment flow, Apple Pay wallet transaction, or live grant/reset/debit concurrency test was performed. Those remain distinct from the sandbox callback replay and zero-grant checks above. Live merchant credentials and GEIDEA enablement remain necessary for production activation.

Official test data: https://docs.geidea.net/docs/test-cards
