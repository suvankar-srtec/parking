
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$ BEGIN
  IF EXISTS (SELECT upper(btrim("rfidCardNo")) FROM vehicles WHERE nullif(btrim("rfidCardNo"), '') IS NOT NULL GROUP BY upper(btrim("rfidCardNo")) HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Duplicate RFID cards exist. Resolve these assignments before applying the RFID migration.'; END IF;
END $$;
UPDATE vehicles SET "rfidCardNo" = nullif(upper(btrim("rfidCardNo")), '') WHERE "rfidCardNo" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_rfidCardNo_key" ON vehicles("rfidCardNo");
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "isInside" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "lastAccessAt" TIMESTAMP(3);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "lastAccessDevice" TEXT;
CREATE INDEX IF NOT EXISTS "vehicles_companyId_isInside_idx" ON vehicles("companyId", "isInside");

CREATE TABLE IF NOT EXISTS rfid_readers (
  id TEXT PRIMARY KEY, "deviceNumber" TEXT NOT NULL, name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'ENTRY_EXIT' CHECK (mode IN ('REGISTER','ENTRY_EXIT','ENTRY','EXIT')),
  enabled BOOLEAN NOT NULL DEFAULT false, "buildingId" TEXT,
  "heartbeatSeconds" INTEGER NOT NULL DEFAULT 0 CHECK ("heartbeatSeconds" = 0 OR "heartbeatSeconds" BETWEEN 5 AND 3600),
  "lastSeenAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfid_readers_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES buildings(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "rfid_readers_deviceNumber_key" ON rfid_readers("deviceNumber");
CREATE INDEX IF NOT EXISTS "rfid_readers_buildingId_idx" ON rfid_readers("buildingId");

CREATE TABLE IF NOT EXISTS rfid_enrollments (
  id TEXT PRIMARY KEY, "readerId" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "vehicleId" TEXT, "cardNo" TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','CAPTURED','COMPLETED','CANCELLED','EXPIRED')),
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfid_enrollments_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES rfid_readers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rfid_enrollments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rfid_enrollments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rfid_enrollments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rfid_enrollments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES vehicles(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "rfid_enrollments_readerId_status_idx" ON rfid_enrollments("readerId", status);
CREATE INDEX IF NOT EXISTS "rfid_enrollments_ownerId_idx" ON rfid_enrollments("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "rfid_enrollments_active_reader_key" ON rfid_enrollments("readerId") WHERE status IN ('WAITING','CAPTURED');

CREATE TABLE IF NOT EXISTS rfid_events (
  id TEXT PRIMARY KEY, "readerId" TEXT, "buildingId" TEXT, "companyId" TEXT, "vehicleId" TEXT,
  "deviceNumber" TEXT NOT NULL, "cardNo" TEXT NOT NULL, action TEXT NOT NULL, code TEXT NOT NULL, message TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfid_events_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES rfid_readers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "rfid_events_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES buildings(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "rfid_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "rfid_events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES vehicles(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "rfid_events_buildingId_createdAt_idx" ON rfid_events("buildingId", "createdAt");
CREATE INDEX IF NOT EXISTS "rfid_events_companyId_createdAt_idx" ON rfid_events("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "rfid_events_readerId_createdAt_idx" ON rfid_events("readerId", "createdAt");
COMMIT;
