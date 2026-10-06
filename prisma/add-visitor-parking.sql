BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "buildings"
  ADD COLUMN IF NOT EXISTS "visitorParking" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "visitorParkingAllocation" INTEGER NOT NULL DEFAULT 0;

-- Visitor parking is a dedicated part of the building Owner parking pool.
-- Existing buildings remain valid because visitorParking starts at 0.
ALTER TABLE "buildings"
  DROP CONSTRAINT IF EXISTS "buildings_parking_values_check";

ALTER TABLE "buildings"
  ADD CONSTRAINT "buildings_parking_values_check" CHECK (
    "totalParking" > 0
    AND "ownerParking" >= 0
    AND "visitorParking" >= 0
    AND "companyParking" >= 0
    AND "ownerParking"::bigint
      + "visitorParking"::bigint
      + "companyParking"::bigint
      = "totalParking"::bigint
  );

COMMIT;
