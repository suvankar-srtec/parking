BEGIN;
ALTER TABLE rfid_readers ADD COLUMN IF NOT EXISTS "registrationQrData" TEXT;
ALTER TABLE rfid_readers ADD COLUMN IF NOT EXISTS "entryExitQrData" TEXT;

UPDATE rfid_enrollments
SET status = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "readerId" IN (
  SELECT id FROM rfid_readers
  WHERE "deviceNumber" = '22110002'
    AND "registrationQrData" IS NULL
    AND "entryExitQrData" IS NULL
)
AND status IN ('WAITING', 'CAPTURED');

UPDATE rfid_readers
SET "buildingId" = NULL,
    enabled = false,
    mode = 'ENTRY_EXIT'
WHERE "deviceNumber" = '22110002'
  AND "registrationQrData" IS NULL
  AND "entryExitQrData" IS NULL;

COMMIT;
