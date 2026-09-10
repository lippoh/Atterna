# AUTHENTICATION FLOW ANALYSIS - CRITICAL ISSUE FOUND

## Email Normalization Comparison

### 1. REGISTRATION (line 89 in actions.ts)
```typescript
const email = parsed.data.email.toLowerCase();
const user = await prisma.user.create({
  data: {
    email,  // ← LOWERCASED
    passwordHash: await argon2.hash(parsed.data.password),
    ...
  },
});
```
**Email stored:** `user@example.com` (lowercase)

---

### 2. PASSWORD RESET (line 272 in actions.ts)
```typescript
const payload = verifyToken(token);
const user = await prisma.user.findUnique({
  where: { email: payload.identifier },  // ← token contains lowercase email
});
await prisma.user.update({
  where: { id: user.id },
  data: {
    passwordHash: await argon2.hash(password),
    passwordChangedAt: new Date(),
  },
});
```
**Email lookup:** Uses token's `payload.identifier` (lowercase from token creation)

---

### 3. LOGIN - Auth.js Credentials Provider (line 26-27 in auth.ts)
```typescript
const user = await prisma.user.findUnique({
  where: { email: parsed.data.email.toLowerCase() },
});
```
**Email lookup:** `parsed.data.email.toLowerCase()`

---

### 4. LOGIN - signInAction (line 318-320 in actions.ts)
```typescript
await signIn("credentials", {
  email: parsed.data.email,  // ← NOT LOWERCASED!
  password: parsed.data.password,
  redirectTo: `/${parsed.data.locale}/dashboard`,
});
```
**Email passed to Auth.js:** `parsed.data.email` (ORIGINAL CASE)

---

## CRITICAL ISSUE IDENTIFIED

**Line 319 in `src/app/[locale]/(app)/actions.ts`:**

```typescript
await signIn("credentials", {
  email: parsed.data.email,  // ← BUG: NOT LOWERCASED
  password: parsed.data.password,
  redirectTo: `/${parsed.data.locale}/dashboard`,
});
```

**BUT** the Auth.js provider at line 27 in `src/lib/auth.ts` does lowercase it:

```typescript
where: { email: parsed.data.email.toLowerCase() },
```

**So why does this cause a problem?**

Let me check if there's a validation issue...
