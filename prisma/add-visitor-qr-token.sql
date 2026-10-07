BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS "qrToken" TEXT;

COMMIT;
