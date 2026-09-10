-- Run this ONCE only if your existing users table came from the earlier
-- passwordHash version of the login project.
-- This intentionally switches the project to plain-text password storage.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "password" TEXT NOT NULL DEFAULT '';

UPDATE "users"
SET
  "username" = 'sp0909',
  "password" = 'admin123',
  "role" = 'SUPER_ADMIN'
WHERE "userId" = '0909';

ALTER TABLE "users"
DROP COLUMN IF EXISTS "passwordHash";
