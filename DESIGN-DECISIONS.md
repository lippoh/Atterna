# Atterna Design Decisions

## 2026-09-08 — Aegean Premium foundation
- Chose porcelain, ink, Aegean blue, and terracotta tokens from the brief to give the product a Greek-rooted editorial identity without postcard motifs.
- Kept document-level `html` and `body` in the root layout because nested locale document tags caused a hydration mismatch; locale layout remains a provider/content boundary.
- Loaded Playfair Display, Inter, and IBM Plex Mono in the root layout so font variables are stable across localized routes.
- Kept the app shell server-first and used CSS media queries for automatic night calm; no theme toggle was added because the brief explicitly defers one.
- Preserved existing server actions, jobs, API routes, integrations, and data access. Redesign work stays in the permitted presentation files.
- Chose native links and form controls over introducing a client navigation layer; this keeps the first render fast for mobile business owners.
- Used the existing SVG chart and component architecture rather than adding a chart dependency; the brief allows only `lucide-react` as a new package.
- Added a root redirect to `/el` so the public entry point reaches the real localized product page instead of the create-next-app placeholder.
- Kept the current translation fallback mechanism and will expand the Greek catalog as surfaces are redesigned, avoiding missing-message crashes while content is migrated.

## 2026-09-08 — Constraints and risks
- Existing business pages contain hardcoded UI strings and partial Greek coverage; these are being removed or localized as each surface is touched.
- Screenshot and Lighthouse tooling availability will be checked after the visual phases; no visual claim is accepted without a browser pass where tooling permits.

## 2026-09-08 — Shipped redesign slices
- Rebuilt the landing page around a product-preview hero, workflow, four product loops, proof, pricing placeholders, native FAQ, and final CTA in both locales.
- Rebuilt the authenticated shell with a desktop product bar, responsive mobile navigation, initials avatar, and scoped automatic dark mode.
- Restyled dashboard metrics, insights, and the SVG trend chart without changing the metrics queries or chart data contract.
- Rebuilt login and registration as split trust layouts; kept their existing `useActionState` flows and server actions untouched.
- Reworked the public QR feedback page and rating control for mobile touch targets, clearer success handoff, and localized comment copy.
- Reworked Reviews for operational scanning with semantic status colors, language badges, localized dates, and focusable rows.
- Browser-checked `/el` at desktop width and corrected a dark-system regression so marketing remains light as specified.

## 2026-09-08 — Remaining work
- Billing, onboarding, settings, review detail, admin, transactional emails, and some empty/error states retain their existing layouts and need the same surface pass.
- Lighthouse metrics and a saved four-breakpoint QA matrix were not run because no Lighthouse runner or screenshot matrix harness is configured in the repository.
- Existing backend-adjacent hardcoded strings remain in untouched presentation files; server actions, jobs, APIs, and data logic were intentionally not modified per the brief.
