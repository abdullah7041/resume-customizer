# Optimize incident reconciliation

## November 24 incident

The production Optimize worker returned `422 OPTIMIZE_NO_VERIFIED_EDITS` after the provider completed. It stopped before billing or result delivery. The credit ledger showed zero Optimize entries during the invocation. The old logs did not record individual rejected references or the terminal Redis write acknowledgement. Correlate older incidents using the deployment, function, stack and timestamp. Keep operation IDs and account-level investigations in the private support tools.

The failure email tagged this production invocation as development. New worker events take their environment and release from Netlify's invocation context, group by workflow stage and cause, and attach the support reference. In Sentry Issues, select project `javascript-react`, choose All Environments for the historical event, and use `workflow:optimize` for newly instrumented worker events.

## Reconciling an uncertain debit

Use the support reference to correlate the Sentry operation, worker log, and the Optimize ledger entry at `credit_transactions.metadata.operation_id`. A missing ledger row alone does not establish that the debit failed. Confirm the balance mutation or transaction outcome in the authoritative billing system. If delivery succeeded, recover the retained result. When the job record expires, the per-input Redis debit marker contains only the operation UUID and continues to block redispatch. Release a marker only after resolving the charge with the candidate and confirming that there is no live worker; use an atomic compare-and-delete against the investigated operation UUID. Never delete an entire account's keys to clear one incident.
