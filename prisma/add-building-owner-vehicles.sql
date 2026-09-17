BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS building_owner_vehicles (
  id TEXT PRIMARY KEY,
  "ownerName" TEXT NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL,
  "rfidCardNo" TEXT,
  "isInside" BOOLEAN NOT NULL DEFAULT false,
  "lastAccessAt" TIMESTAMP(3),
  "lastAccessDevice" TEXT,
  "buildingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "building_owner_vehicles_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES buildings(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "building_owner_vehicles_rfidCardNo_key"
  ON building_owner_vehicles("rfidCardNo");
CREATE UNIQUE INDEX IF NOT EXISTS "building_owner_vehicles_buildingId_plateNumber_key"
  ON building_owner_vehicles("buildingId", "plateNumber");
CREATE INDEX IF NOT EXISTS "building_owner_vehicles_buildingId_idx"
  ON building_owner_vehicles("buildingId");
CREATE INDEX IF NOT EXISTS "building_owner_vehicles_buildingId_isInside_idx"
  ON building_owner_vehicles("buildingId", "isInside");

ALTER TABLE rfid_enrollments ADD COLUMN IF NOT EXISTS "buildingId" TEXT;
ALTER TABLE rfid_enrollments ADD COLUMN IF NOT EXISTS "ownerParking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rfid_enrollments ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE rfid_enrollments ALTER COLUMN "employeeId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "rfid_enrollments_buildingId_idx" ON rfid_enrollments("buildingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfid_enrollments_buildingId_fkey'
  ) THEN
    ALTER TABLE rfid_enrollments
      ADD CONSTRAINT "rfid_enrollments_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES buildings(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE rfid_events ADD COLUMN IF NOT EXISTS "ownerVehicleId" TEXT;
CREATE INDEX IF NOT EXISTS "rfid_events_ownerVehicleId_idx" ON rfid_events("ownerVehicleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfid_events_ownerVehicleId_fkey'
  ) THEN
    ALTER TABLE rfid_events
      ADD CONSTRAINT "rfid_events_ownerVehicleId_fkey"
      FOREIGN KEY ("ownerVehicleId") REFERENCES building_owner_vehicles(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
