-- Rename in place to preserve every building's existing parking values.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
-- Preserve the existing migration lock identity across branding changes.
SELECT pg_advisory_xact_lock(1399293337);
LOCK TABLE "buildings" IN ACCESS EXCLUSIVE MODE;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'buildings' AND column_name = 'companyPool') THEN
    ALTER TABLE "buildings" RENAME COLUMN "companyPool" TO "companyParking";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.buildings'::regclass AND conname = 'buildings_parking_values_check') THEN
    ALTER TABLE "buildings" ADD CONSTRAINT "buildings_parking_values_check" CHECK (
      "totalParking" > 0 AND "ownerParking" >= 0 AND "companyParking" >= 0
      AND "ownerParking"::bigint + "companyParking"::bigint = "totalParking"::bigint
    );
  END IF;
END
$migration$;

COMMIT;
