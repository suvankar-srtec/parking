ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'EMPLOYEE';

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "parkingLimit" INTEGER NOT NULL DEFAULT 1;

UPDATE "employees"
SET "parkingLimit" = GREATEST("parkingLimit", 1)
WHERE "parkingLimit" < 1;
