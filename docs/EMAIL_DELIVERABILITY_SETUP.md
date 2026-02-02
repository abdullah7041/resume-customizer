# Email Deliverability Setup Guide

This guide explains how to configure DNS records for optimal email deliverability using Resend.

## Prerequisites

- Domain: `watheqai.app` (verified in Resend dashboard)
- Email sender: `hello@watheqai.app` (changed from `noreply@` for better trust signals)
- DNS provider: Cloudflare (or your domain registrar)

## Required DNS Records

### 1. DMARC Record (CRITICAL)

**Type:** TXT
**Name:** `_dmarc.watheqai.app`
**Value:**
```
v=DMARC1; p=none; rua=mailto:dmarc-reports@watheqai.app; ruf=mailto:dmarc-failures@watheqai.app; fo=1; adkim=r; aspf=r; pct=100
```

**Explanation:**
- `v=DMARC1` - DMARC version 1
- `p=none` - Policy: Monitor mode (START HERE, upgrade to `p=quarantine` → `p=reject` after verification)
- `rua=` - Aggregate reports email (daily summaries)
- `ruf=` - Forensic reports email (individual failure details)
- `fo=1` - Generate reports for any authentication failure
- `adkim=r` - Relaxed DKIM alignment (allows subdomain sending)
- `aspf=r` - Relaxed SPF alignment
- `pct=100` - Apply policy to 100% of emails

### 2. SPF Record (Usually Auto-Configured by Resend)

**Type:** TXT
**Name:** `watheqai.app`
**Value:**
```
v=spf1 include:_spf.resend.com ~all
```

**Check if this is already set** - Resend usually auto-configures SPF when you verify your domain.

### 3. DKIM Record (Auto-Configured by Resend)

Resend automatically configures DKIM when you verify your domain. Check Resend dashboard at:
https://resend.com/domains

## Verification Steps

### Step 1: Add DMARC Record
1. Log into your DNS provider (Cloudflare)
2. Navigate to DNS records for `watheqai.app`
3. Add TXT record with name `_dmarc` and the value above
4. Save changes (may take 5-60 minutes to propagate)

### Step 2: Verify DNS Propagation
Use these tools to check if records are live:

**Check DMARC:**
```bash
dig TXT _dmarc.watheqai.app +short
# OR
nslookup -type=TXT _dmarc.watheqai.app
```

**Check SPF:**
```bash
dig TXT watheqai.app +short | grep spf
```

**Check DKIM:**
```bash
dig TXT resend._domainkey.watheqai.app +short
```

### Step 3: Test Email Deliverability
1. Send test email via Resend (use waitlist confirmation or credits refresh)
2. Check deliverability using [mail-tester.com](https://www.mail-tester.com/)
   - Forward test email to address provided by mail-tester
   - Target score: **8/10 or higher**

3. Verify emails land in inbox (not spam) for:
   - Gmail
   - Outlook
   - Yahoo

### Step 4: Monitor DMARC Reports
- Wait 24-48 hours for first reports
- Check `dmarc-reports@watheqai.app` for aggregate reports
- Verify all emails show passing authentication (SPF and DKIM aligned)

### Step 5: Upgrade DMARC Policy (After Verification)
Once you confirm 100% of legitimate emails pass authentication:

1. **Week 1-2:** `p=none` (monitor only)
2. **Week 3:** Upgrade to `p=quarantine` (failed emails go to spam)
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@watheqai.app; ...
   ```
3. **Week 4+:** Upgrade to `p=reject` (failed emails blocked entirely)
   ```
   v=DMARC1; p=reject; rua=mailto:dmarc-reports@watheqai.app; ...
   ```

## Code Changes (Already Implemented)

### Changed Sender Address
**Before:**
```javascript
const SENDER_EMAIL = 'noreply@watheqai.app';
```

**After:**
```javascript
const SENDER_EMAIL = 'hello@watheqai.app';  // Better trust signals
```

**Rationale:** "no-reply" addresses decrease trust and inbox reputation. Using a friendly sender like "hello@" or "support@" improves deliverability.

### Removed SVG Images
**Before:**
```html
<svg width="32" height="32">...</svg>
```

**After:**
```html
<span style="font-size: 32px;">✓</span>
```

**Rationale:** Gmail and some email clients don't support SVG images. Unicode characters and PNG images are better supported.

## Best Practices (2026)

1. **Never use "no-reply" addresses** - Always allow users to reply
2. **Use DMARC with p=reject** - Protects your domain from spoofing
3. **Avoid SVG in emails** - Not supported by Gmail
4. **Use subdomain for sending (optional but recommended)**:
   - Current: `hello@watheqai.app`
   - Recommended: `hello@mail.watheqai.app`
   - Benefits: Protects root domain reputation, segments by purpose

5. **Monitor bounce rates** - High bounces (>5%) hurt deliverability
6. **Allow unsubscribe** - Include `List-Unsubscribe` header (already implemented)

## Troubleshooting

### Emails Going to Spam

**Check:**
1. DMARC record is published and valid
2. SPF and DKIM are passing (use mail-tester.com)
3. Sender reputation (check at [senderscore.org](https://senderscore.org))
4. Email content doesn't trigger spam filters (avoid ALL CAPS, excessive exclamation marks)

### DMARC Reports Not Arriving

**Possible causes:**
1. Record not propagated yet (wait 24-48 hours)
2. No emails sent yet (send test emails first)
3. Email provider filters DMARC reports (check spam folder)

### Low Mail-Tester Score

**Common issues:**
- Missing DMARC record → Add TXT record
- SPF not aligned → Verify Resend configuration
- DKIM not aligned → Check Resend dashboard
- Generic email content → Add personalization, unsubscribe link

## Resources

- [Resend DMARC Guide](https://resend.com/docs/dashboard/domains/dmarc)
- [2026 SPF/DKIM/DMARC Best Practices](https://www.uriports.com/blog/spf-dkim-dmarc-best-practices/)
- [DMARC Policy Guide](https://dmarc.org/overview/)
- [Email Deliverability Checker](https://www.mail-tester.com/)

## Post-Launch Monitoring

After deploying these changes:

1. **Week 1:** Monitor DMARC reports for authentication failures
2. **Week 2:** Check inbox placement for major providers (Gmail, Outlook, Yahoo)
3. **Week 3:** Upgrade DMARC to `p=quarantine` if 100% passing
4. **Week 4:** Upgrade DMARC to `p=reject` for maximum protection

---

**Last Updated:** 2026-02-03
**Maintainer:** Watheq Development Team
