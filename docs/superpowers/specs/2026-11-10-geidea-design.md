# GEIDEA sandbox integration

Implement the November 10 integration email's KSA Checkout v2 flow on `codex/geidea-integration`, without adding dependencies. The supplied merchant account is a test account. The public product currently offers a waitlist, not a paid entitlement.

## Approach

Use hosted checkout redirection: it avoids loading a payment SDK or handling card data in Watheq. An embedded modal is also supported by GEIDEA but adds script, iframe, and lifecycle work with no benefit to the initial sandbox qualification. Direct card APIs are unnecessary.

## Boundaries

- Administrator-only `/dev/payments` creates a fixed SAR 1 sandbox payment through an authenticated Netlify function. Amount, currency, reference, callback URL, and return URL are server-owned. English/Arabic checkout language is selectable.
- Save the payment before calling GEIDEA; return its hosted checkout URL only after saving the session ID. User-controlled metadata cannot grant access or change the charge.
- Verify callback HMAC in constant time, then fetch the order through GEIDEA's authenticated API. Match merchant, the random server-owned reference, amount, currency, and `isTest` before updating the ledger; require a saved session for that reference. GEIDEA's documented fetched-order schema exposes no session ID to compare. Store only identifiers, status, and card brand; never card details or the callback body.
- Record updates atomically and idempotently. A delayed failure cannot overwrite a successful payment. Status reads require the same authenticated administrator and payment owner.
- Default disabled; credentials stay in server environment variables. Prepare SQL for the user to run, never apply it. Public pricing and credits remain unchanged while the requested paid entitlement is unresolved.
- Include the exact Apple Pay association attachment. Deployment and GEIDEA activation remain separate external steps.

## Verification

Exercise signatures, tampering, mismatched payments, non-test orders, auth/role/ownership, malformed input, provider failure, callback replay, persistence failure, and the test-page interaction. Run lint, type checks, focused tests, build, and diff checks. Report live card qualification separately from mocked coverage.
