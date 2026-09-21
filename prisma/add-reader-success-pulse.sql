ALTER TABLE "rfid_readers"
ADD COLUMN IF NOT EXISTS "pendingSuccessPulse" BOOLEAN NOT NULL DEFAULT false;
