# Application Credits

Approved offer: SAR 29 once for 100 additional credits, no expiry or renewal. Current feature costs apply. Free credits are spent first; purchased credits survive free resets. The GPT Work report at `C:/Users/NoteBook Pc/Documents/Codex/2026-11-10/watheq-first-paid-offering-research.md` informed the user's decision. Earlier SAR 9 proposals in repository research are historical alternatives, superseded by this approval.

## Activation

1. Review and apply `supabase/migrations/20261110010000_paid_credit_purchases.sql` in Supabase. Repository guidance requires the owner to run migrations. The agent does not apply them.
2. Configure Netlify Functions with existing server Supabase credentials, `GEIDEA_PUBLIC_KEY`, `GEIDEA_API_PASSWORD`, and `SITE_URL` set to the deployed HTTPS origin. All GEIDEA credentials are server-only.
3. Set `GEIDEA_ENVIRONMENT=sandbox` and `GEIDEA_PAYMENTS_ENABLED=true` on a preview. Exercise `/checkout`, return reconciliation, signed callback delivery, failures and cancelled orders. Sandbox orders never grant spendable credits.
4. On the migrated preview/database, verify row locks, duplicate callbacks, concurrent deductions, free resets, original-source failure refunds and cumulative payment refunds. These database operations require runtime qualification beyond mocked handler tests.
5. After GEIDEA supplies and enables live credentials, configure `GEIDEA_ENVIRONMENT=live` and the correct production HTTPS origin. The server rejects orders from the other environment. Enable `GEIDEA_PAYMENTS_ENABLED=true` when ready to accept purchases. The customer price is SAR 29 total; configure applicable tax/receipts with the merchant setup before activation.

Default configuration keeps customer checkout disabled. The existing administrator SAR 1 sandbox route remains independent. Disabling creation must still allow outstanding callbacks and authenticated status reconciliation.

Keep `GEIDEA_SANDBOX_ENABLED=false` when using live merchant credentials. The administrator qualification route is for the test account. The customer environment selector and the administrator sandbox toggle serve different routes.

## Refund operations

Use the GEIDEA merchant portal's transaction screen to issue an approved full or partial refund to the original card. Check the purchase reference and provider order ID first. If a provider response is uncertain, inspect the order before retrying a monetary operation. GEIDEA supports cumulative refunds up to the captured amount.

Verified callbacks or authenticated status reconciliation record cumulative refunded amounts and revoke the corresponding unspent purchased entitlement. A repeated or delayed callback must never regrant a refunded lot. Spent credits cannot be revoked as unspent value; review used/remaining credits when approving a refund. Existing refund policy and statutory rights determine customer eligibility.

For a failed AI action, restore the original debit allocations using its receipt, so a purchased-credit refund remains nonexpiring. Reading saved results and polling jobs do not consume additional credits.

## Qualification limits

The earlier Visa/Mastercard/mada SAR 1 sandbox results are documented in `geidea-integration.md`. They do not establish live merchant activation or deployed purchase-ledger behavior. Arabic PDF compatibility and actual cost/profitability measurement retain their previously documented status. This feature does not change PDF generation.

Official references: [GEIDEA checkout](https://docs.geidea.net/docs/geidea-checkout-v2), [callback signing](https://docs.geidea.net/docs/sample-callback-responses), [refund operations](https://docs.geidea.net/docs/refund-2).

## Local verification

Customer/sandbox gateway and credit-boundary tests passed 72 cases. A subsequent focused integration run passed 123 tests. The broader changed-file regression run passed 604 tests and skipped two, with one failure in the newly added OAuth navigation test because its existing i18n mock lacked `dir()`. After fixing that mock, the affected navigation/checkout/paid-accounting run passed all 20 tests. The full broader run was not repeated after that fixture fix.

Type checking, build, translation validation and whitespace checks passed. Global lint reported one checkout effect-dependency warning; the dependency was fixed and focused lint passed. The build retains the previously documented CSS placeholder, browser zlib, mixed onboarding import and large-chunk warnings.

The migration and `supabase/tests/paid_credit_purchases.sql` have been inspected but not executed. PostgreSQL and Docker are unavailable locally. The SQL test is a rollback-only scenario for duplicate grants, free-first spending, reset protection, debit restoration and refunds. Concurrent database qualification still needs the migrated preview. No live payment activation or new SAR 29 external transaction was performed in this implementation pass.
