# Fresh job alerts

The Job Feed defaults to employer postings with a verified publication timestamp in the past 24 hours. Broader filters cover older jobs and boards without precise dates. Searching and hourly alerts use no credits or AI calls. Users can separately request CV checks.

## Preview qualification

1. Apply `supabase/migrations/20261114010000_job_alerts.sql` to the preview Supabase project. Legacy postings gain provenance on their next successful crawl.
2. Run `supabase/tests/job_alerts.sql` there. It creates and rolls back test fixtures. Qualify overlapping worker claims in two database sessions before release.
3. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_SENDER_EMAIL`, `JOB_CRAWL_SECRET`, and `SITE_URL` for the isolated preview and its verified sender. Email defaults off. Netlify schedules run on published production deploys. For a preview smoke test, set `JOB_ALERTS_ENABLED=true` only in the isolated preview and invoke `job-alerts-background` with the configured crawl secret.
4. Opt in as an internal account with verified email, a saved role, and a followed company with a recent match. Verify receipt and locale, retry with the same delivery ID, unsubscribe, and verify the account receives no further messages. Check that opening and refreshing the Job Feed do not invoke AI or change credits.

## Release

Keep `JOB_ALERTS_ENABLED` off in production until Geidea live approval and preview acceptance. The hourly alert pass starts at minute 20, after the crawler's normal execution window. Coverage depends on successful source checks and precise publication timestamps.

Watch `[JobCrawl]` and `[JobAlerts]` logs for source failures, posting age and send outcomes. Compare Resend send volume and cost with engagement. Check uncertain deliveries in Resend before any manual replay. Once a send has been attempted, its reservations remain in place even when acceptance is uncertain.

Font provenance and hashes are in `public/fonts/thmanyah/source.json`. The Arabic interface font and alerts can ship independently. Set `JOB_ALERTS_ENABLED=false` to stop sends. The additive migration can remain in place during an app rollback.
