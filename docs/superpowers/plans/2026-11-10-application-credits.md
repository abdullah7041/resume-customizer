# Application Credits implementation

Approved by the user's “Go” after reviewing the GPT Work report and SAR 29 / 100-credit recommendation.

## Product contract

One SAR 29 purchase grants 100 additional nonexpiring credits. Eligible free credits continue on their existing reset cycle. Spend free first. No automatic renewal. Use the existing action costs. A verified sandbox transaction never grants spendable credits.

## Implementation

1. Add service-role purchase lots, atomic exactly-once live grants, free-first consumption, original-source failure restoration and reset protection. Preserve aggregate balances for existing callers and handle legacy rows. Provide SQL for the owner to apply.
2. Extend GEIDEA helpers without breaking SAR 1 administrator qualification. Add authenticated customer checkout/status, signed callbacks, authoritative order reconciliation, environment separation and proportional refund handling.
3. Add bilingual `/checkout`, enabled-off-by-default public configuration, pricing entry points and free/purchased balance display. Update active offer/policy copy consistently.
4. Run focused regressions, lint, type checking, build and locale validation separately. Review callback, refund, reset and concurrent-consumption behavior. Preserve unrelated user changes.

## Operations

The repository requires migrations to be applied by the user. Production keys and confirmed merchant activation are external inputs. Prepare all code and setup instructions, keep activation explicit, and report any qualification still requiring deployed functions/database access.
