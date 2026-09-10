-- Draft ID previews may share a number. Only committed user and employee IDs are unique.
-- No saved accounts, credentials, or parking values are changed by this migration.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "user_id_reservations" DROP CONSTRAINT IF EXISTS "user_id_reservations_userId_key";
DROP INDEX IF EXISTS "user_id_reservations_userId_key";
CREATE INDEX IF NOT EXISTS "user_id_reservations_userId_idx" ON "user_id_reservations"("userId");
COMMIT;
