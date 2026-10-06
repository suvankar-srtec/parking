BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  email TEXT NOT NULL,
  "vehicleNumber" TEXT,
  accessory TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "companyId" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "visitors_buildingId_createdAt_idx"
  ON visitors("buildingId", "createdAt");
CREATE INDEX IF NOT EXISTS "visitors_companyId_createdAt_idx"
  ON visitors("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "visitors_createdByUserId_idx"
  ON visitors("createdByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitors_buildingId_fkey'
  ) THEN
    ALTER TABLE visitors
      ADD CONSTRAINT "visitors_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES buildings(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitors_companyId_fkey'
  ) THEN
    ALTER TABLE visitors
      ADD CONSTRAINT "visitors_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitors_createdByUserId_fkey'
  ) THEN
    ALTER TABLE visitors
      ADD CONSTRAINT "visitors_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
