# Production incident repair

Watheq starts one cloud investigation when Sentry delivers a signed production issue alert from a supported user workflow. Telegram and email alerts already configured in Sentry continue normally. Use GitHub on your phone to inspect the proposed patch, regression test and check results. Merging the PR authorizes deployment.

## Connect the services

1. Create the GitHub Actions environment `autofix` and restrict deployment branches to `main`. Store the following secrets in that environment. Keep production data and payment credentials out of it.

   | Secret | Purpose |
   | --- | --- |
   | `AUTOFIX_OPENROUTER_KEY` | A dedicated OpenRouter key with a $5 limit, monthly reset and BYOK usage included in the limit. The runner checks these settings before each attempt. |
   | `AUTOFIX_PR_TOKEN` | A dedicated GitHub identity with access to this repository, contents write and pull requests write. Give it no branch-protection bypass or automatic merge permission. |
   | `AUTOFIX_TELEGRAM_TOKEN`, `AUTOFIX_TELEGRAM_CHAT` | Bot token and destination chat for repair and deployment reports. Open the bot conversation first if using a private chat. |
   | `AUTOFIX_PROBE_TOKEN` | A random 32–128-character URL-safe value shared only with the trusted post-merge check and production Netlify Functions. It distinguishes test traffic from customer failures. |

   Set the environment variable `AUTOFIX_PRODUCTION_ORIGIN` to Watheq’s exact HTTPS production origin. For authenticated feed checks, use the optional `AUTOFIX_SYNTHETIC_SUPABASE_ORIGIN` environment variable and `AUTOFIX_SYNTHETIC_SUPABASE_PUBLIC_KEY`, `AUTOFIX_SYNTHETIC_EMAIL`, `AUTOFIX_SYNTHETIC_PASSWORD` secrets for a dedicated normal test user. Use synthetic data in that account.

2. In Netlify’s **production Functions** environment, set `AUTOFIX_REPOSITORY` to the GitHub owner/repository, `AUTOFIX_DISPATCH_TOKEN` to a repository-scoped GitHub credential with Actions write, and `AUTOFIX_PROBE_TOKEN` to the shared probe value. Set `AUTOFIX_SENTRY_PROJECT` to the numeric Sentry project ID and `AUTOFIX_SENTRY_SECRET` to the internal integration’s client secret. Keep these values out of Vite variables and preview environments.
3. In Sentry, create an internal integration with **Alert Rule Action** enabled. Use `https://<production-host>/.netlify/functions/autofix-alert` as its webhook. Add this integration as an action to the relevant **issue alert rule** for production errors. Keep the existing Telegram and email actions. Watheq checks the raw-body HMAC, project, environment and workflow origin independently of the rule.
4. Merge and deploy the implementation after reviewing CI. Verify that `/autofix-release.json` on the production origin returns the deployed Git SHA. Use a designated test user and an intentionally staged, known failure to qualify real Sentry delivery, Telegram receipt and the mobile review link before relying on the service.

## During an incident

- The webhook forwards the issue number, deployed revision, fixed workflow and error categories, and an optional hashed code location. The runner resolves the hash only against repository paths. Résumé text, job descriptions, event payloads, URLs and raw error messages stay outside the repair prompt.
- A per-issue workflow lock and durable Git tag prevent repeated model runs for the same issue and release. An open repair PR suppresses a second PR for that issue. To retry an unresolved incident after fixing credentials or replenishing the budget, select **Re-run all jobs** on the original Actions run.
- The Codex runner uses `openai/gpt-6.2-sol` at medium reasoning. Its container has access to the source snapshot and a private, model-only gateway. Independent testing starts from trusted repository revisions with networking disabled. Publication runs in a separate job. The bot can submit a code fix with one new focused test. Incidents requiring other changes are reported for manual work.
- A candidate must demonstrate a failing assertion before the patch and a passing test afterward. If main has advanced since the affected release, the runner repeats that check on the proposed PR base. Lint, type checks and the repository suite run before publication. Inspect the test to confirm it represents the symptom reported by the user.
- Once merged, the deployment check waits for the production release marker, runs the available incident-specific synthetic check, and reports the observed result. A missing credential, unsupported journey or different deployed SHA leaves verification pending. There are no periodic test journeys.
- To suspend repair spending, remove the autofix action from the Sentry rule or disable the dedicated OpenRouter key. Existing Sentry alerts continue. Actions job summaries retain the report if Telegram delivery fails.

## Qualification

`python -B -m unittest discover -s scripts/autofix -p 'test_*.py'` checks funding, duplicate handling, patch boundaries and notification decisions. The **Autofix qualification** GitHub workflow exercises a synthetic failure against a temporary Git remote with the actual patch collector, isolated red/green checks and PR publisher. It substitutes local responses for GitHub PR creation and Telegram delivery.

[Sentry issue alert webhooks](https://docs.sentry.io/integrations/integration-platform/webhooks/issue-alerts/) · [OpenRouter key limits](https://openrouter.ai/docs/api/api-reference/api-keys/create-keys)
