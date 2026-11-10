# GEIDEA KSA sandbox integration

Implemented on `codex/geidea-integration` from the GEIDEA integration email dated 10 November 2026. **This is sandbox qualification, not a paid-plan launch.** The customer-facing pricing waitlist and existing credits remain unchanged. See the [pricing decision](research/2026-11-10-pricing-decision.md).

## Setup

1. Review and run [the migration](../supabase/migrations/20261110000000_geidea_sandbox_payments.sql) yourself in Supabase. The agent has **not applied it**. It creates a service-role-only sandbox ledger and a row-locked callback-recording RPC; it grants no customer credits.
2. In a Netlify preview's **Functions** environment, set `GEIDEA_SANDBOX_ENABLED=true`, `GEIDEA_PUBLIC_KEY` and `GEIDEA_API_PASSWORD` from the test-environment email. Use only those sandbox credentials. No credentials belong in Git, browser variables, or `VITE_` keys. Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required.
3. Set `SITE_URL` to that preview's HTTPS origin (no path/query). Both callback and return URLs are built from this value, never the request's Host header. Do not point a preview at the production app for end-to-end verification.
4. Deploy the branch to that preview and sign in as an administrator (`app_metadata.role = 'admin'`, matching Watheq's admin convention). Open `/dev/payments`; choose Arabic or English, create a **SAR 1** checkout and open the hosted link.
5. Use the [official GEIDEA test cards](https://docs.geidea.net/docs/test-cards), not real cards. After return, refresh status to inspect the ledger. Only the signed callback, authenticated order read, and successful database write can mark that ledger paid. A return URL or frontend event cannot do so.

Disabling `GEIDEA_SANDBOX_ENABLED` stops new sessions but deliberately leaves callback processing and authenticated owner status reads working. Keep the keys while outstanding sandbox callbacks are being reconciled.

## Flow and limits

- `geidea-checkout`: authenticated administrator only; strict request validation; server-owned amount/currency/random reference and HTTPS URLs; save payment, create session, save session, then expose hosted checkout. Eight-second provider timeout, existing rate limiter, sanitized structured errors and no-store responses.
- `geidea-webhook`: bounded JSON input, HMAC SHA-256 + constant-time comparison, known-reference lookup, authenticated GEIDEA order read, merchant/reference/amount/currency matching and mandatory `isTest=true`. Raw callbacks and card details are never persisted or logged. Both documented `timeStamp` and `timestamp` spellings are accepted without changing the signed value.
- Database RPC pins an order ID and serializes replay/concurrent updates. Paid status cannot regress on a delayed failure; refunded status stays final. This SQL has been reviewed, **not executed against a database**. Mocked handler replay tests do not prove database behavior.
- GEIDEA's fetched-order sample exposes no session ID. Binding uses the server-generated reference plus a saved session, merchant and verified order; it does not claim an unavailable provider session comparison.
- Status refresh reads the ledger. Lost/exhausted callbacks can leave it pending; no background reconciliation or automatic fulfillment is implemented. The tool grants no credits, subscriptions, recurring payments or production permissions.
- GEIDEA generates GUIDs with non-RFC UUID variants. Backend validation checks the GUID hex shape, instead of rejecting valid provider IDs with a strict RFC-variant validator.

## Apple Pay

The email's attachment is included byte-for-byte at `public/.well-known/apple-developer-merchantid-domain-association` (9,119 bytes). `.gitattributes` disables newline conversion for it. Vite copies it into `dist/.well-known/`; Netlify explicitly serves it as `text/plain`.

Source and production-build copies matched SHA-256 `576b62156cdb73e789ec0a2cba1c9b03aae0623ab39d3c0d505b193848f15f21`.

After deployment, verify the file is publicly accessible on the intended domain, with the actual file body rather than SPA HTML. GEIDEA must enable Apple Pay Web for that merchant/domain. No activation email has been sent and Apple Pay has not been tested. [Official activation steps](https://docs.geidea.net/docs/apple-pay).

## Sandbox evidence — November 10, 2026

Real hosted transactions used the email's **test** credentials, current official frictionless test cards, expiry 01/39 and test CVV. Credentials and full card numbers are not recorded here. Every result below was independently fetched through the authenticated order API and accepted by `verifyOrder`, including the test flag, captured amount, reference, merchant and currency checks.

| Brand | Amount | GEIDEA order ID | Verified result |
| --- | --- | --- | --- |
| Visa | SAR 1 | `0c4f0ec2-f898-4faf-9a41-08df3eb12e3c` | `succeeded`, brand `visa` |
| Mastercard | SAR 1 | `1b7693f2-a826-4ea3-fd35-08df3eb12e47` | `succeeded`, brand `mastercard` |
| mada | SAR 1 | `0eab70ca-1ac4-424e-375f-08df3eb12e44` | `succeeded`, brand `mada` |

These smoke sessions called the new gateway helper directly and used the existing production origin as their return/callback URL. The new endpoints were **not deployed**, so these transactions do **not** establish callback delivery, HMAC shape on a real delivery, persisted ledger success, receipt delivery, or customer credit grants. No production credentials or real-money cards were used. No confirmation was sent to GEIDEA.

## Verification and remaining qualification

Focused gateway/handler/UI tests cover price control, auth/roles/ownership, malformed requests, signing/tampering, provider GUIDs, provider failures, non-test/mismatched orders, persistence failures, duplicate handler delivery, and no optimistic frontend success.

Local results: 39 integration tests passed; with App navigation, the focused run passed 46 tests across four files. The separate `npm run test -- --changed` regression run passed 53 tests across five files. `npm run lint`, `npm run type:check`, `npm run build`, and Git whitespace checks passed. Build emitted CSS placeholder, browser `node:zlib`, mixed onboarding import and chunk-size warnings outside this change; no build failure occurred. The new page is lazy-loaded. No claim is made that the entire repository test suite ran.

Before telling GEIDEA the integration is fully qualified, use the deployed preview and user-applied migration to verify all three card brands through **the saved ledger**, plus decline, cancellation, duplicate callbacks, out-of-order delivery, database failure/retry, and refund status. Request Apple Pay activation separately after domain-file verification.

Documentation lookup used official pages because Context7 MCP was unavailable. The backend skill's `context/CODING_STANDARDS.md` reference is absent; current `CLAUDE.md`, `AGENTS.md` and backend boundaries were used. RTK does not support line-range flags; narrow PowerShell reads were used for those reads. Puppeteer's bundled Chrome was unavailable; installed Edge ran the hosted sandbox tests. React Doctor is not installed; it was not downloaded under the repository's no-new-tools rule.

Sources: [Checkout v2](https://docs.geidea.net/docs/geidea-checkout-v2), [callbacks](https://docs.geidea.net/docs/sample-callback-responses), [fetch order](https://docs.geidea.net/docs/fetch-1), [KSA fetch endpoint](https://docs.geidea.net/reference/get-order-by-id-1).
