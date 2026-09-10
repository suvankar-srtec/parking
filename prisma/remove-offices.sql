-- Keep existing buildings, companies, users, and parking totals.
-- Refuse to remove offices if any office data or account links exist.
-- Repeatable: already-migrated databases are unchanged.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('parkcontrol-company-only'));
LOCK TABLE "users", "buildings", "companies" IN ACCESS EXCLUSIVE MODE;

DO $migration$
BEGIN
  IF to_regclass('public.offices') IS NOT NULL THEN
    LOCK TABLE "offices" IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM "offices") THEN
      RAISE EXCEPTION 'Office records exist. Preserve or migrate them before removing offices.';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM "users" WHERE "role"::text = 'OFFICE_ADMIN') THEN
    RAISE EXCEPTION 'Office admin accounts exist. Migrate these accounts first.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'officeId') THEN
    IF EXISTS (SELECT 1 FROM "users" WHERE "officeId" IS NOT NULL) THEN
      RAISE EXCEPTION 'Office account links exist. Migrate these accounts first.';
    END IF;
    ALTER TABLE "users" DROP COLUMN "officeId";
  END IF;

  DROP TABLE IF EXISTS "offices";

  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'buildings' AND column_name = 'officePool') THEN
    ALTER TABLE "buildings" RENAME COLUMN "officePool" TO "companyPool";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public' AND t.typname = 'UserRole' AND e.enumlabel = 'OFFICE_ADMIN') THEN
    CREATE TYPE "UserRole_company_only" AS ENUM ('SUPER_ADMIN', 'BUILDING_OWNER', 'BUILDING_ADMIN', 'COMPANY_ADMIN');
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_company_only" USING ("role"::text::"UserRole_company_only");
    DROP TYPE "UserRole";
    ALTER TYPE "UserRole_company_only" RENAME TO "UserRole";
  END IF;
END
$migration$;

COMMIT;
