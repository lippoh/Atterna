# Production Signup Email Diagnosis Guide

**Date:** 2026-09-10T15:18:00Z  
**Context:** Vercel Production environment (cannot access directly from local)

---

## CRITICAL FINDING: Local .env vs Vercel Production

**Local .env check shows:**
- ❌ RESEND_API_KEY: NOT present
- ❌ EMAIL_FROM: NOT present
- ❌ APP_URL: NOT present
- ❌ AUTH_SECRET: NOT present
- ✅ DATABASE_URL: Present (Neon)

**This is EXPECTED:** Production secrets are set in Vercel Dashboard, not committed to `.env`.

---

## Diagnostic Procedure (Vercel Dashboard Required)

### Step 1: Verify Vercel Environment Variables

**Go to:** Vercel Dashboard → Project → Settings → Environment Variables

**Check these are set for "Production" environment:**

```
RESEND_API_KEY       = re_... (present?)
EMAIL_FROM           = Atterna <...@domain> (domain verified in Resend?)
APP_URL              = https://... (correct production URL?)
AUTH_SECRET          = ... (32+ chars?)
DATABASE_URL         = postgresql://... (present?)
```

**Critical Check:** What is the **domain** in EMAIL_FROM?
- If it's `onboarding@resend.dev` → This will ONLY deliver to Resend account owner
- If it's a custom domain → Must be **verified** in Resend Dashboard

---

### Step 2: Perform Controlled Signup Test

**Instructions:**

1. Open Vercel production URL in private/incognito window
2. Navigate to `/register` (or `/en/register`)
3. **Use the Resend account owner's email address** as the test email
4. Submit the form
5. **Immediately** go to Vercel Dashboard → Deployments → [Latest] → Logs

---

### Step 3: Analyze Vercel Function Logs

**Search for these patterns in order:**

#### CASE A: Resend Accepted (Success)
```
[mailer] delivered { id: 're_...' }
```
**Meaning:** Email was accepted by Resend API  
**Next step:** Check Resend Dashboard → Emails → find message ID

#### CASE B: Resend Rejected (API Error)
```
resend error { message: '...', name: '...' }
registerAction: verification email failed: <error>
```
**Meaning:** Resend API returned 4xx/5xx  
**Common errors:**
- `403 Forbidden` → Invalid API key or domain not verified
- `422 Unprocessable Entity` → Invalid email format or domain
- `429 Too Many Requests` → Rate limit exceeded

#### CASE C: No Mailer Log (Code Path Issue)
```
(No [mailer] or resend error logs appear)
```
**Meaning:** Code never reached `send()` function  
**Possible causes:**
- Rate limiting blocked the request (check for "rateLimited" error)
- Validation failed before reaching email send
- Server action threw an error before mailer call
- Environment variable validation failed

---

### Step 4: Check Resend Dashboard

**Go to:** Resend Dashboard → Emails (https://resend.com/emails)

**Search for:** The test email address used in signup

**Check message status:**
- ✅ `sent` → Resend accepted, queued for delivery
- ✅ `delivered` → Recipient server accepted
- ⚠️ `bounced` → Recipient server rejected (invalid address, full mailbox)
- ❌ `failed` → Resend couldn't deliver (DNS issue, domain not verified)
- ❌ `rejected` → Resend rejected (domain not verified, suspended account)
- ❓ `absent` → Message never reached Resend (API call failed or never made)

---

## Common Failure Scenarios

### Scenario 1: Domain Not Verified

**Symptoms:**
- Vercel logs: `resend error { message: 'Domain not verified', ... }`
- OR Resend Dashboard: Message status = `rejected`

**Root Cause:**
- `EMAIL_FROM` uses a domain that's not verified in Resend
- Example: `noreply@atterna.gr` but `atterna.gr` not verified

**Fix:**
1. Go to Resend Dashboard → Domains
2. Add domain → Verify DNS records (SPF, DKIM, TXT)
3. Wait for DNS propagation (up to 48h, usually minutes)
4. Retry signup

**Temporary Workaround (TESTING ONLY):**
- Change `EMAIL_FROM` to Resend account owner's email address
- Or use `onboarding@resend.dev` (ONLY delivers to account owner)

---

### Scenario 2: Invalid API Key

**Symptoms:**
- Vercel logs: `resend error { message: 'Invalid API key', ... }`
- HTTP 401 or 403

**Root Cause:**
- `RESEND_API_KEY` is incorrect, expired, or not set
- Key format doesn't start with `re_`

**Fix:**
1. Go to Resend Dashboard → API Keys
2. Create new API key or copy existing
3. Update Vercel environment variable: `RESEND_API_KEY`
4. **Important:** Redeploy after changing env vars

---

### Scenario 3: Rate Limiting (Application-Level)

**Symptoms:**
- No mailer logs in Vercel
- User sees "Rate limited" error on signup form

**Root Cause:**
- 3 signups per hour per IP limit triggered (line 94 in actions.ts)

**Fix:**
- Wait 1 hour
- Or temporarily increase rate limit for testing (not recommended for production)

**Check:**
```
# Search Vercel logs for:
registerAction
# If you see early return before mailer call, rate limit triggered
```

---

### Scenario 4: EMAIL_FROM Format Invalid

**Symptoms:**
- Vercel logs: Environment variable error mentioning `EMAIL_FROM`
- Server action fails before reaching mailer

**Root Cause:**
- `EMAIL_FROM` doesn't match regex in `src/lib/env.ts:36-42`
- Invalid format (missing @, invalid domain, etc.)

**Valid Formats:**
```
Atterna <noreply@atterna.gr>   ✅
noreply@atterna.gr             ✅
Atterna<noreply@atterna.gr>    ❌ (missing space)
noreply@                       ❌ (incomplete)
```

**Fix:**
- Update `EMAIL_FROM` in Vercel env vars to valid format
- Redeploy

---

### Scenario 5: onboarding@resend.dev Limitation

**Symptoms:**
- Vercel logs: `[mailer] delivered { id: 're_...' }`
- Resend Dashboard: Message shows `sent` or `delivered`
- **BUT:** Email not received by test recipient

**Root Cause:**
- `EMAIL_FROM` is set to `onboarding@resend.dev`
- This sender can ONLY deliver to the Resend account owner's email
- Any other recipient will be silently dropped by Resend

**Fix:**
- Add and verify a custom domain in Resend
- Update `EMAIL_FROM` to use verified domain
- Redeploy

**Verify:**
```
# Check current EMAIL_FROM in Vercel Dashboard
# If it contains "resend.dev" → this is likely the issue
```

---

## Diagnostic Checklist

Run through these checks in order:

### 1. Vercel Environment Variables
- [ ] RESEND_API_KEY present and starts with `re_`
- [ ] EMAIL_FROM present and format is valid
- [ ] EMAIL_FROM domain is NOT `onboarding@resend.dev` (unless testing with account owner)
- [ ] APP_URL present and is correct production URL
- [ ] AUTH_SECRET present and 32+ chars
- [ ] All variables set for **Production** environment (not just Preview)

### 2. Resend Dashboard - Domains
- [ ] Custom domain is added (if using custom EMAIL_FROM)
- [ ] Domain status is **Verified** (not Pending)
- [ ] DNS records are configured (SPF, DKIM, verification TXT)

### 3. Resend Dashboard - API Keys
- [ ] API key exists and is active (not revoked)
- [ ] Key permissions include "Send emails"

### 4. Signup Test
- [ ] Used Resend account owner's email as test recipient
- [ ] Signup form submitted successfully (no visible errors)
- [ ] Checked Vercel logs immediately after submission

### 5. Vercel Function Logs
- [ ] Found registerAction log entry
- [ ] Found [mailer] or resend error log entry
- [ ] Noted exact error message if present
- [ ] Noted Resend message ID if present

### 6. Resend Dashboard - Emails
- [ ] Searched for test email address
- [ ] Found message (or confirmed absent)
- [ ] Noted message status

---

## Expected Log Patterns

### Successful Flow
```
// Vercel function logs:
[timestamp] registerAction called
[timestamp] [mailer] delivered { id: 're_abc123xyz' }

// Resend Dashboard:
Message ID: re_abc123xyz
Status: sent → delivered
To: test@example.com
From: Atterna <noreply@atterna.gr>
```

### Failed at Resend (Domain Not Verified)
```
// Vercel function logs:
[timestamp] registerAction called
[timestamp] resend error { message: 'Domain not verified', name: 'validation_error' }
[timestamp] registerAction: verification email failed: Domain not verified

// Resend Dashboard:
No message found (rejected before queueing)
```

### Failed at Application (Rate Limited)
```
// Vercel function logs:
[timestamp] registerAction called
(No mailer logs - returned early)

// User sees:
"Rate limited" error on signup form
```

---

## What to Report Back

After performing the signup test and checking logs, report:

1. **EMAIL_FROM domain** (redact local part):
   - Example: "***@atterna.gr" or "***@resend.dev"

2. **Vercel log excerpt** (sanitize tokens):
   ```
   [timestamp] registerAction called
   [timestamp] [mailer] delivered { id: 're_...' }
   OR
   [timestamp] resend error { message: '...', name: '...' }
   ```

3. **Resend Dashboard status:**
   - Message found? (yes/no)
   - Message ID? (if found)
   - Status? (sent/delivered/bounced/failed/rejected)

4. **Email received?** (yes/no)

---

## Next Steps Based on Diagnosis

### If CASE A (Resend accepted):
- Check Resend Dashboard for delivery status
- If delivered but not received → check spam folder
- If bounced → check recipient email validity
- If failed → check domain DNS records

### If CASE B (Resend rejected):
- Read exact error message
- Most likely: domain not verified or invalid API key
- Fix root cause, redeploy, retest

### If CASE C (No mailer log):
- Check for rate limiting or validation errors
- Check if registerAction threw an error before reaching send()
- Check environment variable validation (EMAIL_FROM, etc.)

---

## Manual Verification Steps

If you have access to Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Check environment variables (doesn't expose values)
vercel env ls

# Pull environment variables to local (creates .env.local)
vercel env pull .env.local

# View recent logs
vercel logs --follow
```

---

## Code Reference

**Signup flow:** `src/app/[locale]/(app)/actions.ts:78-142`  
**Mailer:** `src/lib/mailer.ts:54-93`  
**Env validation:** `src/lib/env.ts:32-42`  

**Key log locations:**
- Success: `src/lib/mailer.ts:87` → `console.log("[mailer] delivered", { id })`
- Failure: `src/lib/mailer.ts:84` → `console.error("resend error", error)`
- Action failure: `src/app/[locale]/(app)/actions.ts:132` → `console.error("registerAction: verification email failed")`

---

## IMPORTANT: Redeploy After Environment Changes

**If you change ANY environment variable in Vercel:**
1. Go to Vercel Dashboard → Deployments
2. Click "..." on latest deployment → "Redeploy"
3. OR push a new commit to trigger deployment

**Environment variables are NOT hot-reloaded.** Changes only take effect after redeployment.

---

**End of Diagnostic Guide**
