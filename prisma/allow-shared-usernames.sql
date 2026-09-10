-- User ID remains globally unique. Only usernames become non-unique.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE "users" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_key";
DROP INDEX IF EXISTS "users_username_key";
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");
COMMIT;
