# Atterna Product Experience Overhaul — Phase 0 Findings

**Date:** 2026-09-10  
**Scope:** Complete system architecture understanding before redesign

---

## Executive Summary

Atterna is a **Continuous Reputation Intelligence SaaS** for Greece hospitality/local businesses. The existing architecture is solid — reputation scoring, provider abstraction, auth, Stripe billing, email verification, cron jobs, and Prisma migrations are all production-ready and must be preserved.

**Current State:**
- ✅ Working backend architecture (auth, billing, reputation, providers)
- ✅ Prisma 7 with migrations, PG adapter
- ✅ Next.js 15 + React 19 + next-intl (EN/EL)
- ✅ Tailwind + shadcn/ui primitives
- ❌ Performance feels slow (blocking UI, sequential queries)
- ❌ Visual design feels generic/plain
- ❌ Dashboard is metric-heavy but not intelligence-focused
- ❌ Connections/providers UI hidden in Settings
- ❌ No motion/interaction system
- ❌ Landing page is placeholder-level

---

## 1. Architecture

### Stack
- **Framework:** Next.js 15.0.4-canary.26 (App Router, RSC, Server Actions)
- **React:** 19.0.0-rc
- **Database:** PostgreSQL (Neon) via Prisma 7.0.0-canary.62 + `@prisma/adapter-pg`
- **Auth:** Auth.js v5 (NextAuth) + argon2 password hashing
- **Billing:** Stripe webhooks (source of truth), checkout, portal
- **Email:** Resend (lazy-loaded, HMAC token verification)
- **i18n:** next-intl (EN/EL, messages/, server/client hooks)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Monitoring:** Sentry
- **Cron:** `/api/cron/*` routes (reputation sync, email alerts)

### Key Files
- `prisma/schema.prisma` — 25 tables, reputation intelligence models
- `middleware.ts` — locale detection, public/auth/cron route guards
- `src/lib/session.ts` — `requireUser()`, `requireOrg()` guards
- `src/lib/auth.ts` — Credentials provider, argon2 verify
- `src/lib/stripe.ts` — checkout, portal, webhook handlers
- `src/lib/reputation/` — score, analytics, insights
- `src/lib/sources/registry.ts` — provider abstraction (GBP, Tripadvisor, Booking, etc.)

---

## 2. Prisma Schema (Simplified)

**Core entities:**
- `User` → `Membership` → `Organization` → `Business`
- `Subscription` (Stripe-managed, TRIALING/ACTIVE/CANCELED/PAST_DUE)
- `Review` (source, rating, text, sentiment, receivedAt)
- `ReviewAnalysis` (sentiment, themes[])
- `ResponseDraft` (AI-generated replies, status workflow)
- `FeedbackRequest` (QR/direct feedback, token-based)

**Reputation Intelligence:**
- `Issue` (RECURRING/EMERGING, category, severity, trend, mentions, sources[], status workflow)
- `Recommendation` (title, steps[], impact, status workflow)
- `Competitor` (organizationId, name, placeId, city, rating, reviewCount, observations[])
- `BusinessInsight` (windowStart/End, fingerprint, payload JSON)
- `ReputationSnapshot` (date, periodStart/End, breakdown JSON)

**Provider connections:**
- `GbpConnection` (OAuth, accountId, locationId, lastSync)
- Future: Tripadvisor, Booking, etc. (schema-ready, UI placeholder)

---

## 3. Reputation Intelligence System

**File:** `src/lib/reputation/score.ts`

### Calculation Flow
1. **Fetch reviews** (30d/90d/180d windows)
2. **Compute base metrics:**
   - Average rating
   - Total reviews
   - Sentiment distribution (POSITIVE/NEUTRAL/NEGATIVE)
   - Response rate
   - Response time (median hours)
3. **Score components:**
   - Volume score (review count vs baseline)
   - Rating score (weighted avg)
   - Sentiment score
   - Recency score (time decay)
   - Response score
4. **Weighted aggregate:** 0–100 reputation health score
5. **Trend:** compare current vs previous period

**File:** `src/lib/reputation/analytics.ts`
- Issue detection (recurring vs emerging themes)
- Theme extraction from reviews
- Competitor benchmarking
- Seasonal pattern detection
- Recommendation generation

**Current UI:** Dashboard shows score + metrics, but feels static.

---

## 4. Routes & Pages

### Public
- `/` — Landing page (basic hero + CTA, needs premium redesign)
- `/[locale]/(auth)/login` — email + password
- `/[locale]/(auth)/register` — signup + email verification
- `/[locale]/(auth)/forgot-password` — reset flow

### Authenticated App
- `/[locale]/(app)/dashboard` — **Main reputation intelligence view**
  - Health score card
  - Trend chart (7d/30d/90d)
  - Metric grid (reviews, avg rating, sentiment, response rate/time)
  - Top themes
  - Issues panel (recurring/emerging)
  - Recommendations panel
- `/[locale]/(app)/reviews` — Review list + filters (all/unanswered/negative/published) + per-source chips
- `/[locale]/(app)/feedback` — QR code generation (feels slow, no progress)
- `/[locale]/(app)/settings` — General settings
- `/[locale]/(app)/settings/sources` — **Provider connections** (currently hidden here)
- `/[locale]/(app)/billing` — Plan cards + usage + Stripe portal
- `/[locale]/(app)/onboarding` — 2-step wizard (org creation → data import)

### API
- `/api/[...nextauth]` — Auth.js
- `/api/webhooks/stripe` — Stripe subscription state (source of truth)
- `/api/cron/reputation-sync` — Daily reputation calculation
- `/api/cron/alerts` — Negative review alerts
- `/api/gbp/callback` — Google Business Profile OAuth

---

## 5. UI Components & Design System

### Current State
- **Primitive library:** shadcn/ui (Button, Input, Label, Dialog, etc.)
- **Styling:** Tailwind CSS with custom color palette:
  - `ink-*` (text/neutral)
  - `aegean-*` (primary blue)
  - `success-*`, `danger-*`, `terracotta-*` (semantic)
  - `sunken` (muted background)
  - `line`, `line-strong` (borders)
- **Typography:** `font-display` (headings), default sans
- **Icons:** Lucide React (`IconChartLine`, `IconStar`, etc.)

### Existing Components
- `src/components/ui/` — shadcn primitives
- `src/components/app/nav-tabs.tsx` — Desktop top nav + mobile bottom bar
- `src/components/dashboard/metric-card.tsx` — Simple metric display
- `src/components/dashboard/trend-chart.tsx` — Line chart (Recharts)
- `src/components/dashboard/intel/health-card.tsx` — Score visualization
- `src/components/dashboard/intel/issues-panel.tsx` — Issues + Recommendations with status buttons
- `src/components/reviews/review-list.tsx` — Review rows with sentiment badges

### Assessment
- ✅ Components are functional and well-structured
- ❌ Visual design is plain (generic cards, minimal hierarchy)
- ❌ No animation/motion system
- ❌ No loading states (blank → content jump)
- ❌ Charts are basic (Recharts default styling)
- ❌ Mobile responsive but not deliberately designed

---

## 6. Navigation & Layout

**Desktop:**
- Top bar: Logo + nav tabs (Dashboard, Reviews, Feedback, Settings) + user menu
- Main content area
- No sidebar

**Mobile:**
- Fixed bottom nav bar (4 tabs with icons + labels + active indicator)
- Safe area insets respected

**Current Issues:**
- Billing is a separate top-level nav item (should be in Settings)
- No visual hierarchy between primary/secondary nav
- No breadcrumbs or contextual navigation
- Settings/sources is buried (Connections deserves prominence)

---

## 7. Performance Observations (Pre-Audit)

**Visible Issues:**
- Route transitions feel slow
- Click → response delay on many actions
- Dashboard loads everything sequentially (feels like waterfalls)
- QR generation blocks UI with no progress feedback
- Settings/billing mutations block without optimistic UI
- No skeleton/loading states (blank → content flash)
- Heavy client components (`"use client"` on nav, which is fine, but excessive elsewhere?)

**Likely Causes (to be measured in Phase 1):**
- Sequential Prisma queries (no `Promise.all`)
- Repeated `auth()` / `requireOrg()` calls per request
- No caching/revalidation strategy
- Blocking server actions
- Recharts bundle loaded on dashboard (heavy)
- No code splitting for charts/heavy UI

---

## 8. Localization (i18n)

**Implementation:** next-intl with `messages/en.json` and `messages/el.json`

**Namespaces:**
- `nav`, `landing`, `auth`, `dashboard`, `reviews`, `feedback`, `settings`, `billing`, `onboarding`, `admin`, `common`, `sources`

**Current Coverage:**
- ✅ Both EN/EL complete for existing UI
- ❌ Some hardcoded strings (e.g., "Most popular" in billing)
- ❌ Date/number formatting inconsistent

**Requirements:**
- All new UI strings must go through i18n
- Greek must not be an afterthought
- Text expansion (Greek is 20–30% longer) must be tested

---

## 9. Provider/Connection Architecture

**File:** `src/lib/sources/registry.ts`

**Supported Sources (in code):**
- `google` (Google Business Profile)
- `tripadvisor`
- `booking`
- `facebook`
- `expedia`
- `thefork`
- `yelp`
- `trustpilot`
- `direct` (QR/manual feedback)
- `csv` (manual import)

**Current Implementation:**
- ✅ GBP OAuth flow exists (requires API approval)
- ✅ CSV import exists
- ✅ Direct feedback via QR works
- ❌ Other providers are schema/code-ready but not UI-exposed
- ❌ Connection status UI is minimal (hidden in Settings → Sources)

**UI Requirements (Phase 0 spec):**
- Build first-class "Connections" or "Data Sources" hub
- Show all providers with connection state (Available/Connected/Coming Soon/Requires Approval)
- Logo, description, status, last sync, review count, connect/manage actions
- Do NOT fake APIs that don't exist
- Do NOT scrape or use unofficial endpoints
- Show "Google requires approval" honestly

---

## 10. What Must NOT Change

### Backend Architecture (Preserve)
- ✅ Prisma migrations (5 migrations committed, status clean)
- ✅ Auth.js credential flow + argon2
- ✅ Stripe webhook as subscription source of truth
- ✅ Resend email verification flow
- ✅ Reputation scoring algorithm
- ✅ Provider abstraction pattern
- ✅ Cron job routes
- ✅ Sentry integration
- ✅ Session guards (`requireUser`, `requireOrg`)
- ✅ Tenant isolation (businessId guard)
- ✅ Audit log writes

### Database
- ✅ No schema changes unless genuinely required
- ✅ No `prisma db push` or `prisma migrate reset`
- ✅ No destructive SQL
- ✅ Production data untouched

---

## 11. Phase 1+ Focus Areas

### Performance (Phase 1 + Stage B)
1. Measure baseline (dashboard, reviews, settings, QR)
2. Parallelize Prisma queries (`Promise.all`)
3. Deduplicate `auth()` / `requireOrg()` calls
4. Add loading boundaries
5. Code-split heavy dependencies (Recharts)
6. Implement caching/revalidation
7. Use optimistic UI for mutations
8. Add progress feedback for QR generation

### Design System (Stage C)
1. Establish visual identity (premium, intelligent, data-driven)
2. Redesign primitives (buttons, cards, badges, tooltips, modals)
3. Create metric visualization components
4. Define motion/animation principles
5. Build skeleton/loading/empty states
6. Establish typography scale
7. Refine color palette (current palette is good, needs depth)

### Dashboard (Stage D)
1. Redesign as **Reputation Intelligence Command Center**
2. Prominent health score + trend visualization
3. Emerging vs recurring issues (interactive drill-down)
4. Recent customer signals (not just metrics)
5. Competitor intelligence panel
6. Actionable recommendations with status workflow
7. Source badges/indicators
8. Interactive panels (click issue → detail view)

### Connections (Stage E)
1. Create dedicated "Connections" / "Data Sources" page
2. Move out of Settings (promote to primary nav or dashboard)
3. Provider cards with logos, status, last sync, review count
4. Connection flow for each provider (where implemented)
5. "Coming Soon" / "Requires Approval" states
6. Error/sync state indicators
7. Make it visually excellent (this is a core differentiator)

### Settings (Stage F)
1. Proper settings architecture (General, Data Sources, Notifications, Team, Security, Billing, Danger Zone)
2. Move Billing into Settings (not top-level nav)
3. Subtle plan indicator elsewhere if needed (not dominant)
4. Premium settings feel (not admin template)

### QR/Feedback (Stage G)
1. Improve QR generation performance (actual + perceived)
2. Immediate click acknowledgment
3. Meaningful progress (not fake percentage)
4. Success state with preview
5. Download/share/print actions
6. Visual upgrade to QR page

### Motion (Stage H)
1. Page transitions
2. Staggered entrance animations
3. Chart animations
4. Number transitions
5. Modal/drawer transitions
6. Expanding panels
7. Hover/focus states
8. Skeleton shimmer
9. Respect `prefers-reduced-motion`

### Landing Page (Stage I)
1. Premium product marketing experience
2. Hero: interactive reputation intelligence visualization
3. Problem → Solution → Intelligence → Actions → Results flow
4. Scroll-driven storytelling
5. 3D/WebGL only if genuinely beneficial (not heavy demo)
6. Fast load, mobile-friendly, accessible

### QA (Stage J)
1. Responsive design (desktop/laptop/tablet/mobile)
2. Accessibility (keyboard nav, focus, ARIA, color contrast, reduced motion)
3. Localization (EN/EL parity, text expansion, date/number formatting)
4. Build verification (TypeScript, tests, production build)
5. No auth/billing/email regressions

---

## 12. Dependencies (package.json)

**Current:**
- `next@15.0.4-canary.26`
- `react@19.0.0-rc`, `react-dom@19.0.0-rc`
- `@prisma/client@7.0.0-canary.62`, `@prisma/adapter-pg@7.0.0-canary.62`
- `next-auth@5.0.0-beta.25`
- `next-intl@3.26.4`
- `stripe@17.6.0`
- `resend@4.1.2`
- `@sentry/nextjs@8.46.0`
- `argon2@0.45.1`
- `recharts@2.15.0` (charts — heavy, needs lazy load)
- `lucide-react@0.468.0` (icons)
- `tailwindcss@3.4.17`
- `class-variance-authority@0.7.1`, `clsx@2.1.1`, `tailwind-merge@2.6.0`

**Potential Additions (to be decided per phase):**
- Motion: `framer-motion` (lightweight) or CSS animations?
- 3D: `@react-three/fiber` + `@react-three/drei` (landing page only, lazy-loaded)
- Charts: Keep Recharts but lazy-load, or switch to lighter alternative?

---

## 13. Git History Context

**Recent commits:**
- `07e3349` — Cron hardening
- `f323361` — Atterna email updates
- `a439177` — Schema updates (Invoice.organization, reputation tables)
- Earlier: Prisma 7 migration reconciliation, billing/Stripe work, email verification fixes

**Branch:** `master` → `origin/master`  
**Status:** Clean working tree

---

## 14. Remaining Phase 0 Questions (Answered)

- ✅ Is Tailwind + shadcn the design system? **Yes, extend it.**
- ✅ Are there existing reusable components? **Yes, in `src/components/`.**
- ✅ Is i18n EN/EL complete? **Yes, both namespaces populated.**
- ✅ Is the reputation scoring system stable? **Yes, preserve algorithm.**
- ✅ Is the provider abstraction extensible? **Yes, registry pattern is solid.**
- ✅ Are there API routes or only server actions? **Both — API for webhooks/OAuth, server actions for mutations.**
- ✅ Is there a mobile design? **Yes, bottom nav bar + responsive layouts.**
- ✅ Is there any animation currently? **No.**
- ✅ Are charts client or server? **Client (Recharts), loaded on dashboard.**

---

## Phase 0 Complete ✅

**Next:** Phase 1 — Performance Audit + Baseline Measurements

