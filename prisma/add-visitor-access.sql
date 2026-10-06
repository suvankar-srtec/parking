BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE visitors ADD COLUMN IF NOT EXISTS "validFrom" TIMESTAMP(3);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS "isInside" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS "lastAccessAt" TIMESTAMP(3);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS "lastAccessDevice" TEXT;

UPDATE visitors
SET "validFrom" = COALESCE("validFrom", "createdAt"),
    "validUntil" = COALESCE("validUntil", "createdAt" + INTERVAL '1 day')
WHERE "validFrom" IS NULL OR "validUntil" IS NULL;

ALTER TABLE visitors ALTER COLUMN "validFrom" SET NOT NULL;
ALTER TABLE visitors ALTER COLUMN "validUntil" SET NOT NULL;

ALTER TABLE rfid_events ADD COLUMN IF NOT EXISTS "visitorId" TEXT;

CREATE INDEX IF NOT EXISTS "visitors_buildingId_isInside_idx"
  ON visitors("buildingId", "isInside");
CREATE INDEX IF NOT EXISTS "visitors_companyId_isInside_idx"
  ON visitors("companyId", "isInside");
CREATE INDEX IF NOT EXISTS "rfid_events_visitorId_idx"
  ON rfid_events("visitorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfid_events_visitorId_fkey'
  ) THEN
    ALTER TABLE rfid_events
      ADD CONSTRAINT "rfid_events_visitorId_fkey"
      FOREIGN KEY ("visitorId") REFERENCES visitors(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
