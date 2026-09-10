-- ============================================================================
-- PREFLIGHT VERIFICATION — READ-ONLY inspection of Atterna production Neon
-- ============================================================================
-- PURPOSE: run this against PRODUCTION before the reconcile migration is
-- approved. It produces ZERO writes (SELECT / catalog queries only).
--
-- HOW: psql "$DATABASE_URL" -f preflight-verification.sql
--      (or run each statement from your SQL console)
--
-- GATE RULES (from the migration's header):
--   P3-STOP: if any of the "INVALID VALUE" / "NULL VALUE" queries at the
--   bottom returns rows, STOP and report the values — do not run the
--   migration as-is.
--   P2: compare the "COLUMN INVENTORY" output against the migration's
--   Section 1 claims; any extra missing column must be added to the
--   migration first.
-- ============================================================================

\echo '=== 1. MIGRATION HISTORY STATE (expect: table missing OR zero rows) ==='
-- catalog-only (parse-safe even when _prisma_migrations does not exist):
SELECT CASE WHEN t.relname IS NULL
            THEN 'NO _prisma_migrations TABLE (pure db push history)'
            ELSE 'table exists — live rows (approx): ' || coalesce(s.n_live_tup::text, '0') END
       AS prisma_history
FROM (SELECT 1) x
LEFT JOIN pg_class t
       ON t.relname = '_prisma_migrations' AND t.relnamespace = 'public'::regnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = t.oid;
-- if the table EXISTS, also run manually:
--   SELECT id, migration_name, finished_at FROM _prisma_migrations;

\echo '=== 2. TABLE INVENTORY (13 existing + 12 missing expected) ==='
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo '=== 2b. ROW COUNTS (per existing table) ==='
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           ORDER BY table_name LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.table_name) INTO n;
    RAISE NOTICE 'table % : % rows', r.table_name, n;
  END LOOP;
END $$;

\echo '=== 3. ENUM TYPES (expect 5: MembershipRole, ReviewSource, Urgency, DraftStatus, SubStatus — Locale/Sentiment MISSING) ==='
SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
GROUP BY t.typname ORDER BY t.typname;

\echo '=== 4. COLUMN INVENTORY — focus tables (validate the drift inventory) ==='
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('User','Business','Review','ReviewAnalysis','ResponseDraft',
                     'Subscription','FeedbackRequest','AuditLog')
ORDER BY table_name, ordinal_position;

\echo '=== 5. INDEX INVENTORY — focus tables ==='
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('User','Business','Review','ResponseDraft','Subscription',
                    'FeedbackRequest','AuditLog','Membership')
ORDER BY tablename, indexname;

\echo '=== 6. FK / UNIQUE CONSTRAINT INVENTORY — focus tables ==='
SELECT conrelid::regclass AS table_name, conname, contype,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid::regclass::text IN ('User','Business','Review','ReviewAnalysis',
    'ResponseDraft','Subscription','FeedbackRequest','AuditLog','Membership',
    'Organization','GbpConnection')
ORDER BY conrelid::regclass::text, conname;

\echo '=== 7. DISTINCT VALUES for the three TEXT->ENUM conversions ==='
SELECT 'User.locale' AS column, "locale"::text AS value, count(*) AS n
FROM "User" GROUP BY "locale" ORDER BY n DESC;

SELECT 'Business.locale' AS column, "locale"::text AS value, count(*) AS n
FROM "Business" GROUP BY "locale" ORDER BY n DESC;

SELECT 'ReviewAnalysis.sentiment' AS column, sentiment::text AS value, count(*) AS n
FROM "ReviewAnalysis" GROUP BY sentiment ORDER BY n DESC;

\echo '=== 8. P3 GATES — any row returned here means STOP ==='

\echo '--- 8a. invalid User.locale (must be empty) ---'
SELECT 'User.locale' AS gate, id, "locale" FROM "User"
WHERE "locale" IS NULL OR "locale"::text NOT IN ('EL','EN');

\echo '--- 8b. invalid Business.locale (must be empty) ---'
SELECT 'Business.locale' AS gate, id, "locale" FROM "Business"
WHERE "locale" IS NULL OR "locale"::text NOT IN ('EL','EN');

\echo '--- 8c. invalid ReviewAnalysis.sentiment (must be empty) ---'
SELECT 'ReviewAnalysis.sentiment' AS gate, id, sentiment FROM "ReviewAnalysis"
WHERE sentiment IS NULL OR sentiment::text NOT IN ('POSITIVE','NEUTRAL','NEGATIVE');

\echo '--- 8d. orphan check for the new AuditLog FKs (must be 0 orphans) ---'
-- guarded: actorUserId may not exist yet in the pre-migration state (N/A then)
DO $$
DECLARE n bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='AuditLog' AND column_name='actorUserId') THEN
    EXECUTE 'SELECT count(*) FROM "AuditLog" a WHERE a."actorUserId" IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."actorUserId")' INTO n;
    RAISE NOTICE 'AuditLog.actorUserId orphans: % (must be 0)', n;
  ELSE
    RAISE NOTICE 'AuditLog.actorUserId column not present yet — orphan check N/A (expected pre-migration)';
  END IF;
  EXECUTE 'SELECT count(*) FROM "AuditLog" a WHERE a."organizationId" IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o.id = a."organizationId")' INTO n;
  RAISE NOTICE 'AuditLog.organizationId orphans: % (must be 0)', n;
END $$;

\echo '=== 9. BACKFILL SCALE (Section 2 review) ==='
SELECT (SELECT count(*) FROM "ResponseDraft")      AS response_drafts,
       (SELECT count(*) FROM "FeedbackRequest")    AS feedback_requests,
       (SELECT count(*) FROM "Review")             AS reviews,
       (SELECT count(*) FROM "ReviewAnalysis")     AS review_analyses;

\echo '=== 10. LARGE-TABLE CHECK (Section 5 note: plain vs CONCURRENTLY) ==='
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 100000
ORDER BY n_live_tup DESC;

\echo '=== PREFLIGHT COMPLETE — review outputs before approving anything ==='
