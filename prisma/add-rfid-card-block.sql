BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS "rfidBlocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE building_owner_vehicles
  ADD COLUMN IF NOT EXISTS "rfidBlocked" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
