-- Match the existing reader handler's terminal duplicate-card status.
-- Existing enrollment rows and all accepted statuses are preserved.
BEGIN;
ALTER TABLE "rfid_enrollments" DROP CONSTRAINT IF EXISTS "rfid_enrollments_status_check";
ALTER TABLE "rfid_enrollments" ADD CONSTRAINT "rfid_enrollments_status_check"
  CHECK (status IN ('WAITING', 'CAPTURED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DUPLICATE'));
COMMIT;
