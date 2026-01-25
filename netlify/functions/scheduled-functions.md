# Netlify Scheduled Functions (Cron Jobs)

This document describes how to configure scheduled functions in Netlify.

## Functions

### 1. cron-reset-credits
**Purpose:** Reset monthly credits for users whose last reset was >30 days ago

**Schedule:** Daily at 2 AM GMT+3

**Cron Expression:** `0 2 * * *` (UTC)
- Note: GMT+3 is UTC+3, so 2 AM GMT+3 = 11 PM UTC previous day
- Actual cron for 2 AM GMT+3: `0 23 * * *` (UTC)

**URL:** `https://watheq.app/.netlify/functions/cron-reset-credits`

**Calls:**
- `addCredits()` - Reset to 15 credits
- `sendCreditsRefreshedEmail()` - Notify users

---

### 2. cron-monthly-summary
**Purpose:** Send monthly usage summary emails to all users

**Schedule:** 28th of each month at 10 AM GMT+3

**Cron Expression:** `0 10 28 * *` (UTC)
- Note: 10 AM GMT+3 = 7 AM UTC
- Actual cron for 10 AM GMT+3: `0 7 28 * *` (UTC)

**URL:** `https://watheq.app/.netlify/functions/cron-monthly-summary`

**Calls:**
- `sendMonthlyUsageSummary()` - Send usage breakdown email

---

## Configuration Steps

### Option 1: Netlify Dashboard UI (Recommended)

1. Go to **Site Settings** → **Functions** → **Scheduled Functions**
2. Click **Create Scheduled Function**
3. Configure each function:
   - **Function Name:** `cron-reset-credits`
   - **Cron Expression:** `0 23 * * *` (UTC for 2 AM GMT+3)
   - **Description:** "Reset monthly user credits"
   - Click **Create**
4. Repeat for `cron-monthly-summary`:
   - **Function Name:** `cron-monthly-summary`
   - **Cron Expression:** `0 7 28 * *` (UTC for 10 AM GMT+3)
   - **Description:** "Send monthly usage summary emails"

### Option 2: netlify.toml Configuration (If Supported)

Add to `netlify.toml`:

```toml
[functions."cron-reset-credits"]
  timeout = 30
  schedule = "0 23 * * *"  # 2 AM GMT+3 = 11 PM UTC previous day

[functions."cron-monthly-summary"]
  timeout = 30
  schedule = "0 7 28 * *"  # 10 AM GMT+3 = 7 AM UTC
```

Currently, Netlify requires schedule configuration via dashboard or API.

### Option 3: Netlify API

```bash
curl -X POST https://api.netlify.com/api/v1/sites/{SITE_ID}/functions/cron-reset-credits/triggers \
  -H "Authorization: Bearer YOUR_NETLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "schedule",
    "input": {
      "schedule": "0 23 * * *"
    }
  }'
```

---

## Testing Scheduled Functions

### Local Development

To test cron functions locally:

```bash
# Start Netlify dev server
npm run dev:netlify

# Trigger function manually
curl -H "x-netlify-internal-functions: true" \
  http://localhost:8888/.netlify/functions/cron-reset-credits
```

### Staging/Production

```bash
# Trigger directly (requires authentication)
curl -H "Authorization: Bearer YOUR_NETLIFY_TOKEN" \
  https://watheq.app/.netlify/functions/cron-reset-credits
```

---

## Monitoring & Logging

- Check function logs in **Netlify Dashboard** → **Functions** → **Function Logs**
- All errors logged with `[cron-reset-credits]` or `[cron-monthly-summary]` prefix
- Failed emails logged with count in response
- Check Sentry for unhandled exceptions

---

## Timezone Handling

**Important:** Netlify cron jobs run in UTC. Adjust times accordingly:

| GMT+3 Time | UTC Time | Cron |
|-----------|----------|------|
| 2 AM      | 11 PM (prev day) | 0 23 * * * |
| 10 AM     | 7 AM     | 0 7 28 * * |

---

## Fallback & Retry

- If a cron job fails, Netlify may retry (check dashboard settings)
- Email failures are logged but don't block credit reset
- Transactions are always logged even if email fails

---

## Next Steps

1. Deploy to production (`git push origin main`)
2. Go to Netlify dashboard
3. Configure scheduled functions using Option 1 (Dashboard UI)
4. Test with manual triggers
5. Monitor logs for first few executions
