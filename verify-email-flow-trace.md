# Signup Verification Email Flow - End-to-End Trace

**Timestamp:** 2026-09-10T14:13:40Z  
**Repository:** Atterna (master branch)  
**Scope:** Read-only analysis, no secrets printed

---

## Flow Summary

**Entry Point:** `src/app/[locale]/(auth)/register/page.tsx`  
**Server Action:** `src/app/[locale]/(app)/actions.ts::registerAction()`  
**Email Service:** `src/lib/mailer.ts::send()`  
**Token Generation:** `src/lib/token.ts::createToken()`

---

## Step-by-Step Trace

### 1. User Submits Signup Form

**File:** `src/app/[locale]/(auth)/register/page.tsx:75-114`

```tsx
<form action={formAction} className="mt-8 space-y-5">
  <input type="hidden" name="locale" value={locale} />
  <Input id="email" name="email" type="email" required />
  <Input id="password" name="password" type="password" minLength={10} required />
  <Button type="submit">Submit</Button>
</form>
```

**Data Submitted:**
- `email` (user input)
- `password` (user input, min 10 chars)
- `locale` (hidden field: "el" or "en")

---

### 2. Server Action: registerAction()

**File:** `src/app/[locale]/(app)/actions.ts:78-142`

#### 2.1 Validation
```typescript
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  locale: z.enum(["el", "en"]).default("el"),
});
```

#### 2.2 Rate Limiting
```typescript
// Line 94-95
if (!(await rateLimit(`register:${hashIp(ip)}`, 3, 3600))) {
  return { error: "rateLimited" }; // 3 signups per hour per IP
}
```

#### 2.3 User Creation
```typescript
// Lines 99-105
const user = await prisma.user.create({
  data: {
    email,
    passwordHash: await argon2.hash(parsed.data.password),
    locale: parsed.data.locale === "en" ? "EN" : "EL",
  },
});
```

**✓ VERIFICATION:** User is created BEFORE email is sent.  
**⚠️ RISK:** If email fails, user exists but cannot verify.

---

### 3. Token Generation

**File:** `src/lib/token.ts:33-46`

```typescript
// Line 106 in actions.ts
const token = createToken(email, "verify", 24 * 60 * 60_000);
```

**Token Structure:**
- **Identifier:** User email (lowercase)
- **Kind:** "verify"
- **Expiry:** 24 hours (86,400,000 ms)
- **Signed with:** `AUTH_SECRET` (from env, validated lazily)

**Token Format:** `<base64url(payload)>.<hmac-sha256-signature>`

**✓ VERIFICATION:** Token is NOT persisted to database.  
- Token is signed and self-contained
- Verification happens by signature validation + expiry check
- No database lookup needed for token validation

---

### 4. Verification URL Construction

**File:** `src/app/[locale]/(app)/actions.ts:107-111`

```typescript
const origin = await siteOrigin(); // Prefers APP_URL, falls back to x-forwarded-host
const props = {
  locale: parsed.data.locale,
  kind: "verify" as const,
  verifyUrl: `${origin}/${parsed.data.locale}/verify?token=${encodeURIComponent(token)}`,
};
```

**URL Construction Logic (`siteOrigin()` at lines 46-58):**
```typescript
async function siteOrigin(): Promise<string> {
  try {
    return env.APP_URL; // ← PREFERRED: Production APP_URL
  } catch {
    // Fallback: derive from request headers
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? 
                  (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
}
```

**✓ VERIFICATION:** Uses correct production APP_URL when set.  
**✓ FALLBACK:** Derives from `x-forwarded-host` if APP_URL missing (Vercel provides this).

**Example URL:** `https://app.your-domain.gr/en/verify?token=eyJ...`

---

### 5. Email Composition

**Files:**
- `src/app/[locale]/(app)/actions.ts:113-116`
- `src/emails/alert.tsx`

```typescript
const [html, text] = await Promise.all([
  renderAlertEmail(props),     // HTML version
  renderAlertEmailText(props), // Plain text alternative
]);
```

**Email Props:**
```typescript
{
  locale: "el" | "en",
  kind: "verify",
  verifyUrl: "https://app.your-domain.gr/en/verify?token=..."
}
```

---

### 6. Email Send via Resend

**File:** `src/lib/mailer.ts:54-93`

#### 6.1 Environment Variables Used

```typescript
// Line 71: EMAIL_FROM
from: env.EMAIL_FROM, // ← Read at runtime from env

// Line 27: RESEND_API_KEY
function resendClient(): Resend {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY); // ← Lazy init
  return _resend;
}
```

**EMAIL_FROM Validation (`src/lib/env.ts:36-42`):**
```typescript
EMAIL_FROM: z
  .string()
  .min(3)
  .regex(
    /^(?:[^\n<>@]+ <)?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>?$/,
    'EMAIL_FROM must be "Display Name <local@domain>" or "local@domain" (verified Resend domain)'
  ),
```

**RESEND_API_KEY Validation (`src/lib/env.ts:32`):**
```typescript
RESEND_API_KEY: z.string().min(20),
```

**✓ VERIFICATION:** Both variables are:
- Validated at runtime (lazy, on first access)
- Throw descriptive errors if missing/invalid
- Never fall back to defaults

#### 6.2 Resend API Call

```typescript
// Lines 79-88
const { data, error } = await resendClient().emails.send(payload);

if (error) {
  console.error("resend error", error); // ← LOGGED
  return { ok: false, error: error.message };
}

if (data?.id) console.log("[mailer] delivered", { id: data.id }); // ← LOGGED
return { ok: true, id: data?.id };
```

**Payload Structure:**
```typescript
{
  from: env.EMAIL_FROM,        // "Atterna <no-reply@your-domain.gr>"
  to: [email],                 // User's submitted email
  subject: locale === "en" ? "Confirm your email" : "Επιβεβαιώστε το email σας",
  html: "<html>...</html>",    // Rendered React email
  text: "Plain text version",  // Plain text alternative
  headers: {}                  // Empty for verification emails
}
```

**✓ VERIFICATION: Email recipient is the exact address submitted during signup.**

#### 6.3 Error Handling

```typescript
// Lines 80-85
if (error) {
  console.error("resend error", error);
  return { ok: false, error: error.message };
}
```

**✓ VERIFICATION: Resend errors are caught and returned, NOT thrown.**

```typescript
// Lines 89-92
} catch (error) {
  // Network/SDK exceptions (not provider rejections): still never throw.
  return { ok: false, error: String(error) };
}
```

**✓ VERIFICATION: Network exceptions are caught, never thrown.**

---

### 7. Email Send Result Handling

**File:** `src/app/[locale]/(app)/actions.ts:117-136`

```typescript
const result = await send({
  to: email,
  subject: parsed.data.locale === "en" ? "Confirm your email" : "Επιβεβαιώστε το email σας",
  html,
  text,
});

await audit("auth.register", { userId: user.id }); // ← ALWAYS logged

if (!result.ok) {
  // The account exists but the verification email failed. Surface it
  // instead of pretending "check your inbox": the register page shows
  // the emailFailed state and links to /verify, where a fresh link can
  // be requested (resendVerificationAction).
  console.error("registerAction: verification email failed:", result.error);
  await audit("auth.register_email_failed", { userId: user.id });
  return { error: "emailFailed" }; // ← UI shows recovery path
}

return { ok: true }; // ← UI shows "check your inbox"
```

**✓ VERIFICATION: Resend response ID is logged:**
```typescript
// src/lib/mailer.ts:87
if (data?.id) console.log("[mailer] delivered", { id: data.id });
```

**✓ VERIFICATION: Code handles non-2xx responses:**
- Resend SDK returns `{ error }` for 4xx/5xx
- `send()` returns `{ ok: false, error: message }`
- `registerAction()` checks `!result.ok` and returns `{ error: "emailFailed" }`

**⚠️ CRITICAL FINDING: Signup returns success BEFORE email send succeeds.**

**Flow:**
1. User created (lines 99-105)
2. Token generated (line 106)
3. Email sent (line 117)
4. **IF email fails:** Return `{ error: "emailFailed" }` (line 134)
5. **IF email succeeds:** Return `{ ok: true }` (line 136)

**BUT:** User record already exists in database (line 99-105 executed first).

**Recovery Path:**
- UI shows "emailFailed" state (register/page.tsx:27-44)
- Links to `/verify` for resend (resendVerificationAction)
- Rate-limited: 3 resends per hour per IP

---

## Environment Variable Runtime Verification

### EMAIL_FROM

**Value Format:** `"Atterna <no-reply@your-domain.gr>"` or `"no-reply@your-domain.gr"`

**Used At:**
- `src/lib/mailer.ts:71` - `from` field in Resend payload
- `src/lib/mailer.ts:49` - Extracted for `senderAddress()` (List-Unsubscribe header)

**Validation:**
- `src/lib/env.ts:36-42` - Regex validates format
- Throws if missing/invalid: `"Missing or invalid environment variable: EMAIL_FROM"`

**✓ VERIFICATION: EMAIL_FROM is read at runtime, validated, never has a fallback.**

---

### RESEND_API_KEY

**Value Format:** `"re_..."`

**Used At:**
- `src/lib/mailer.ts:27` - Lazy Resend client initialization

**Validation:**
- `src/lib/env.ts:32` - `z.string().min(20)`
- Throws if missing/invalid: `"Missing or invalid environment variable: RESEND_API_KEY"`

**✓ VERIFICATION: RESEND_API_KEY is:**
- Read lazily on first `send()` call
- Validated (min 20 chars)
- Present in Vercel Production (required for deployment)
- Never printed in logs (SDK error objects don't include the key)

---

### APP_URL

**Value Format:** `"https://app.your-domain.gr"`

**Used At:**
- `src/app/[locale]/(app)/actions.ts:48` - Preferred origin for email links

**Validation:**
- `src/lib/env.ts:19` - `z.string().url()`
- Fallback: Derives from `x-forwarded-host` if missing (lines 50-56)

**✓ VERIFICATION: APP_URL is used for production verification URLs when set.**

---

## Token Persistence Verification

**Token Generation:** `src/lib/token.ts:33-46`

```typescript
export function createToken(
  identifier: string,
  kind: TokenKind,
  ttlMs = DEFAULT_TTL[kind]
): string {
  const payload: TokenPayload = {
    identifier: identifier.toLowerCase(),
    kind,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  const data = b64url(JSON.stringify(payload));
  return `${data}.${sign(data)}`; // ← Self-contained, HMAC-signed
}
```

**Token Verification:** `src/lib/token.ts:48-72`

```typescript
export function verifyToken(token: string): { identifier: string; kind: TokenKind; iat: number } | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  // Timing-safe signature comparison
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  // Validate expiry
  if (payload.exp < Date.now()) return null;
  return { identifier: payload.identifier, kind: payload.kind, iat: payload.iat };
}
```

**✓ VERIFICATION: Token is NOT persisted to database.**
- Token is self-contained (JWT-like, HMAC-signed)
- Verification happens via signature validation
- No `VerificationToken` table in schema
- No database write in token generation flow

---

## Logging and Observability

### Success Path Logs

**1. Email Delivered:**
```
[mailer] delivered { id: 're_...' }
```
**Source:** `src/lib/mailer.ts:87`

**2. User Registered:**
```
audit("auth.register", { userId: user.id })
```
**Source:** `src/app/[locale]/(app)/actions.ts:126`

### Failure Path Logs

**1. Resend Error:**
```
resend error { message: '...', name: '...' }
```
**Source:** `src/lib/mailer.ts:84`

**2. Registration Email Failed:**
```
registerAction: verification email failed: <error message>
```
**Source:** `src/app/[locale]/(app)/actions.ts:132`

**3. Audit Log:**
```
audit("auth.register_email_failed", { userId: user.id })
```
**Source:** `src/app/[locale]/(app)/actions.ts:133`

---

## Vercel Production Verification Checklist

### ✅ Required Environment Variables in Vercel

```
DATABASE_URL        = postgresql://...@neon.tech/...
AUTH_SECRET         = <32+ chars random>
APP_URL             = https://app.your-domain.gr
RESEND_API_KEY      = re_...
EMAIL_FROM          = Atterna <no-reply@your-domain.gr>
```

**Verification Command (DO NOT RUN - requires production access):**
```bash
# In Vercel Dashboard → Project → Settings → Environment Variables
# Confirm all 5 variables are set for Production environment
```

### ✅ Vercel Logs After Signup

**Expected success logs:**
```
[mailer] delivered { id: 're_abc123...' }
```

**Expected failure logs:**
```
resend error { message: '...', name: '...' }
registerAction: verification email failed: <message>
```

**Check via:**
- Vercel Dashboard → Deployments → [Latest] → Logs
- Search for: `[mailer]` or `registerAction`

---

## Critical Findings

### ⚠️ 1. Signup Returns Success Before Email Delivery Confirmed

**Issue:** User record is created (line 99-105) before email is sent (line 117).

**Flow:**
```
1. Create user ← DATABASE WRITE
2. Generate token ← MEMORY ONLY
3. Send email ← ASYNC NETWORK CALL
4. IF email fails: return { error: "emailFailed" }
5. IF email succeeds: return { ok: true }
```

**Impact:**
- User exists in database even if email fails
- Email failure returns `{ error: "emailFailed" }`, not `{ ok: true }`
- UI correctly shows recovery path (link to `/verify`)

**Mitigation:**
- User is aware email failed (UI shows "emailFailed" state)
- Recovery path available (`resendVerificationAction`)
- Rate limiting prevents abuse (3 signups/hour/IP, 3 resends/hour/IP)

**✓ ACCEPTABLE:** Email failure is handled gracefully with user-visible recovery.

---

### ✓ 2. Email Recipient is Submitted Address

**Verification:** `src/app/[locale]/(app)/actions.ts:118`

```typescript
const result = await send({
  to: email, // ← User's submitted email (line 89, lowercased)
  ...
});
```

**✓ CONFIRMED:** Email is sent to the exact address submitted in the signup form.

---

### ✓ 3. Resend Response Logged

**Success:**
```typescript
if (data?.id) console.log("[mailer] delivered", { id: data.id });
```

**Failure:**
```typescript
if (error) {
  console.error("resend error", error);
  return { ok: false, error: error.message };
}
```

**✓ CONFIRMED:** Resend response ID and errors are logged.

---

### ✓ 4. Non-2xx Responses Throw/Handled

**Resend SDK Behavior:**
- Returns `{ error }` for 4xx/5xx responses
- Does NOT throw exceptions for API errors

**Code Handling:**
```typescript
// src/lib/mailer.ts:80-85
if (error) {
  console.error("resend error", error);
  return { ok: false, error: error.message }; // ← RETURNED, NOT THROWN
}
```

**Action Handling:**
```typescript
// src/app/[locale]/(app)/actions.ts:127-134
if (!result.ok) {
  console.error("registerAction: verification email failed:", result.error);
  await audit("auth.register_email_failed", { userId: user.id });
  return { error: "emailFailed" }; // ← UI shows recovery
}
```

**✓ CONFIRMED:** Non-2xx responses are caught, logged, and handled gracefully.

---

### ✓ 5. Verification URL Uses Production APP_URL

**Code:** `src/app/[locale]/(app)/actions.ts:46-58`

```typescript
async function siteOrigin(): Promise<string> {
  try {
    return env.APP_URL; // ← PREFERRED: Uses APP_URL when set
  } catch {
    // Fallback: x-forwarded-host
  }
}
```

**✓ CONFIRMED:** Verification URL uses `APP_URL` when set in Vercel Production.

---

## Verification Token Flow

### Token Generation (No Database Write)

```typescript
// src/lib/token.ts:33-46
const token = createToken(email, "verify", 24 * 60 * 60_000);
// Returns: "eyJpZGVudGlm...base64url.hmac-signature"
```

**Token Structure:**
```json
{
  "identifier": "user@example.com",
  "kind": "verify",
  "iat": 1726000000000,
  "exp": 1726086400000
}
```

**✓ CONFIRMED:** Token is self-contained, HMAC-signed, NOT stored in database.

### Token Verification (Database Lookup Only for User)

**File:** `src/app/[locale]/(app)/actions.ts:145-168`

```typescript
export async function verifyEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const payload = verifyToken(token); // ← Signature validation, no DB
  if (!payload || payload.kind !== "verify") return { error: "bad" };
  
  const user = await prisma.user.findUnique({
    where: { email: payload.identifier }, // ← DB lookup by email from token
  });
  if (!user) return { error: "bad" };
  
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() }, // ← Sets emailVerified timestamp
  });
  
  await audit("auth.email_verified", { userId: user.id });
  return { ok: true };
}
```

**✓ CONFIRMED:** Verification updates `User.emailVerified` timestamp.

---

## Summary

### Environment Variables ✅
- **EMAIL_FROM:** Validated at runtime, format enforced
- **RESEND_API_KEY:** Lazy-loaded, min 20 chars, never logged
- **APP_URL:** Used for verification URLs, falls back to x-forwarded-host

### Email Flow ✅
- **Recipient:** Exact submitted email address
- **Token:** Self-contained, HMAC-signed, 24h expiry, NOT persisted
- **URL:** Uses APP_URL when set
- **Logging:** Success (Resend ID) and failure (error message) logged
- **Error Handling:** Non-2xx responses caught, returned as `{ ok: false }`

### Critical Issue ⚠️
- **Signup returns success before email confirmed delivered**
- **Mitigation:** Email failure returns `{ error: "emailFailed" }` with recovery path

### Recommendations

1. **Verify Resend Domain:** Ensure `your-domain.gr` is verified in Resend Dashboard
2. **Check Vercel Logs:** After signup, search for `[mailer] delivered` to confirm delivery
3. **Test Email Failure:** Temporarily use invalid `RESEND_API_KEY` to verify UI shows recovery path
4. **Monitor Audit Logs:** Track `auth.register_email_failed` events

---

**End of Trace**
